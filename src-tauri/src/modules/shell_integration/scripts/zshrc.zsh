# Pragma shell integration: restores the user's ZDOTDIR, loads their .zshrc and marks
# prompts and commands with OSC 133.
__pragma_si_zdotdir="$ZDOTDIR"
ZDOTDIR="${PRAGMA_USER_ZDOTDIR:-$HOME}"
builtin unset PRAGMA_USER_ZDOTDIR
# /etc/zshrc derives HISTFILE from ZDOTDIR before the user's files run.
if [[ "$HISTFILE" == "$__pragma_si_zdotdir/.zsh_history" ]]; then
  HISTFILE="$ZDOTDIR/.zsh_history"
fi
builtin unset __pragma_si_zdotdir
if [[ -f "$ZDOTDIR/.zshrc" ]]; then
  builtin source "$ZDOTDIR/.zshrc"
fi

if [[ -o interactive && -z "${__pragma_si_loaded-}" ]]; then
  typeset -g __pragma_si_loaded=1

  __pragma_si_precmd() {
    builtin printf '\e]133;D;%s\a\e]133;A\a' "$?"
  }

  __pragma_si_mark_input() {
    [[ "$PS1" == *$'\e]133;B'* ]] || PS1="$PS1"$'%{\e]133;B\a%}'
  }

  __pragma_si_preexec() {
    builtin printf '\e]133;C\a'
  }

  precmd_functions=(__pragma_si_precmd $precmd_functions __pragma_si_mark_input)
  preexec_functions=($preexec_functions __pragma_si_preexec)
fi
