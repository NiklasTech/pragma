//! Parakeet TDT inference: NeMo mel preprocessor, Conformer encoder and a
//! greedy token-and-duration transducer decode, all through ONNX Runtime.

use ort::session::Session;
use ort::value::Tensor;
use std::path::Path;

const MAX_TOKENS_PER_STEP: usize = 10;
const STATE_LAYERS: usize = 2;
const STATE_SIZE: usize = 640;

pub struct ParakeetModel {
    preprocessor: Session,
    encoder: Session,
    decoder_joint: Session,
    vocab: Vec<String>,
    blank: usize,
}

fn session(path: &Path) -> Result<Session, String> {
    Session::builder()
        .map_err(|e| format!("Cannot create ONNX session: {e}"))?
        .commit_from_file(path)
        .map_err(|e| format!("Cannot load {}: {e}", path.display()))
}

fn parse_vocab(text: &str) -> Result<Vec<String>, String> {
    let mut vocab = Vec::new();
    for line in text.lines().filter(|line| !line.is_empty()) {
        let (token, id) = line
            .rsplit_once(' ')
            .ok_or_else(|| "Invalid Parakeet vocabulary".to_string())?;
        let id: usize = id
            .parse()
            .map_err(|_| "Invalid Parakeet vocabulary".to_string())?;
        if id != vocab.len() {
            return Err("Invalid Parakeet vocabulary".to_string());
        }
        vocab.push(token.replace('\u{2581}', " "));
    }
    Ok(vocab)
}

fn argmax(values: &[f32]) -> usize {
    let mut best = 0;
    for (index, value) in values.iter().enumerate() {
        if *value > values[best] {
            best = index;
        }
    }
    best
}

/// Drops a space that starts the text or precedes punctuation, like NeMo's detokenizer.
fn join_tokens(pieces: &[&str]) -> String {
    let chars: Vec<char> = pieces.concat().chars().collect();
    let mut text = String::with_capacity(chars.len());
    for (index, c) in chars.iter().enumerate() {
        if !c.is_whitespace() {
            text.push(*c);
            continue;
        }
        let next_is_word = chars
            .get(index + 1)
            .is_some_and(|next| next.is_alphanumeric() || *next == '_');
        if index > 0 && next_is_word {
            text.push(' ');
        }
    }
    text
}

impl ParakeetModel {
    pub fn load(dir: &Path) -> Result<Self, String> {
        let vocab_text = std::fs::read_to_string(dir.join("vocab.txt"))
            .map_err(|e| format!("Cannot read Parakeet vocabulary: {e}"))?;
        let vocab = parse_vocab(&vocab_text)?;
        let blank = vocab
            .iter()
            .position(|token| token == "<blk>")
            .ok_or_else(|| "Parakeet vocabulary has no blank token".to_string())?;
        Ok(Self {
            preprocessor: session(&dir.join("nemo128.onnx"))?,
            encoder: session(&dir.join("encoder-model.int8.onnx"))?,
            decoder_joint: session(&dir.join("decoder_joint-model.int8.onnx"))?,
            vocab,
            blank,
        })
    }

    pub fn transcribe(&mut self, samples: Vec<f32>) -> Result<String, String> {
        let (features, feature_lens) = self.preprocess(samples)?;
        let (encoded, frames, dim) = self.encode(features, feature_lens)?;
        let tokens = self.decode(&encoded, frames, dim)?;
        let pieces: Vec<&str> = tokens.iter().map(|id| self.vocab[*id].as_str()).collect();
        Ok(join_tokens(&pieces))
    }

    fn preprocess(&mut self, samples: Vec<f32>) -> Result<(Tensor<f32>, Tensor<i64>), String> {
        let len = samples.len();
        let waveforms = Tensor::from_array(([1usize, len], samples)).map_err(ort_error)?;
        let lens = Tensor::from_array(([1usize], vec![len as i64])).map_err(ort_error)?;
        let outputs = self
            .preprocessor
            .run(ort::inputs!["waveforms" => waveforms, "waveforms_lens" => lens])
            .map_err(ort_error)?;
        let (shape, features) = outputs["features"]
            .try_extract_tensor::<f32>()
            .map_err(ort_error)?;
        let shape: Vec<usize> = shape.iter().map(|d| *d as usize).collect();
        let (_, feature_lens) = outputs["features_lens"]
            .try_extract_tensor::<i64>()
            .map_err(ort_error)?;
        Ok((
            Tensor::from_array((shape, features.to_vec())).map_err(ort_error)?,
            Tensor::from_array(([1usize], feature_lens.to_vec())).map_err(ort_error)?,
        ))
    }

    /// Returns the encoder output as `[dim, frames]` plus the valid frame count.
    fn encode(
        &mut self,
        features: Tensor<f32>,
        feature_lens: Tensor<i64>,
    ) -> Result<(Vec<f32>, usize, usize), String> {
        let outputs = self
            .encoder
            .run(ort::inputs!["audio_signal" => features, "length" => feature_lens])
            .map_err(ort_error)?;
        let (shape, encoded) = outputs["outputs"]
            .try_extract_tensor::<f32>()
            .map_err(ort_error)?;
        let (_, lens) = outputs["encoded_lengths"]
            .try_extract_tensor::<i64>()
            .map_err(ort_error)?;
        if shape.len() != 3 {
            return Err("Unexpected Parakeet encoder output".to_string());
        }
        let dim = shape[1] as usize;
        let total = shape[2] as usize;
        let frames = lens
            .first()
            .map_or(0, |len| (*len).max(0) as usize)
            .min(total);
        let mut transposed = vec![0.0f32; frames * dim];
        for t in 0..frames {
            for d in 0..dim {
                transposed[t * dim + d] = encoded[d * total + t];
            }
        }
        Ok((transposed, frames, dim))
    }

    fn decode(&mut self, encoded: &[f32], frames: usize, dim: usize) -> Result<Vec<usize>, String> {
        let vocab_size = self.vocab.len();
        let state_len = STATE_LAYERS * STATE_SIZE;
        let mut state1 = vec![0.0f32; state_len];
        let mut state2 = vec![0.0f32; state_len];
        let mut tokens: Vec<usize> = Vec::new();
        let mut t = 0usize;
        let mut emitted = 0usize;

        while t < frames {
            let frame = encoded[t * dim..(t + 1) * dim].to_vec();
            let previous = tokens.last().copied().unwrap_or(self.blank) as i32;
            let outputs = self
                .decoder_joint
                .run(ort::inputs![
                    "encoder_outputs" => Tensor::from_array(([1usize, dim, 1], frame)).map_err(ort_error)?,
                    "targets" => Tensor::from_array(([1usize, 1], vec![previous])).map_err(ort_error)?,
                    "target_length" => Tensor::from_array(([1usize], vec![1i32])).map_err(ort_error)?,
                    "input_states_1" => Tensor::from_array(([STATE_LAYERS, 1, STATE_SIZE], state1.clone())).map_err(ort_error)?,
                    "input_states_2" => Tensor::from_array(([STATE_LAYERS, 1, STATE_SIZE], state2.clone())).map_err(ort_error)?,
                ])
                .map_err(ort_error)?;
            let (_, logits) = outputs["outputs"]
                .try_extract_tensor::<f32>()
                .map_err(ort_error)?;
            if logits.len() <= vocab_size {
                return Err("Unexpected Parakeet decoder output".to_string());
            }
            let token = argmax(&logits[..vocab_size]);
            let step = argmax(&logits[vocab_size..]);

            if token != self.blank {
                let (_, next1) = outputs["output_states_1"]
                    .try_extract_tensor::<f32>()
                    .map_err(ort_error)?;
                let (_, next2) = outputs["output_states_2"]
                    .try_extract_tensor::<f32>()
                    .map_err(ort_error)?;
                state1.copy_from_slice(next1);
                state2.copy_from_slice(next2);
                tokens.push(token);
                emitted += 1;
            }

            if step > 0 {
                t += step;
                emitted = 0;
            } else if token == self.blank || emitted == MAX_TOKENS_PER_STEP {
                t += 1;
                emitted = 0;
            }
        }
        Ok(tokens)
    }
}

fn ort_error(error: ort::Error) -> String {
    format!("Parakeet inference failed: {error}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn joins_sentencepiece_tokens_like_nemo() {
        assert_eq!(
            join_tokens(&[" Hallo", " Welt", ",", " wie", " geht", "'s", "?"]),
            "Hallo Welt, wie geht's?"
        );
        assert_eq!(join_tokens(&[" Hello", " wor", "ld", "."]), "Hello world.");
    }

    #[test]
    fn parses_indexed_vocabulary() {
        let vocab = parse_vocab("<unk> 0\n\u{2581}the 1\n<blk> 2\n").unwrap();
        assert_eq!(vocab, vec!["<unk>", " the", "<blk>"]);
        assert!(parse_vocab("a 1\n").is_err());
    }
}
