# Pragma shell integration: loads the user's .bashrc and marks prompts and commands with OSC 133.
if [ -r "$HOME/.bashrc" ]; then
  . "$HOME/.bashrc"
fi

if [[ $- == *i* && -z "${__pragma_si_loaded-}" ]]; then
  __pragma_si_loaded=1
  __pragma_si_ready=0

  __pragma_si_prompt_start() {
    local status=$?
    __pragma_si_ready=0
    builtin printf '\033]133;D;%s\007\033]133;A\007' "$status"
    return "$status"
  }

  __pragma_si_prompt_end() {
    local status=$?
    case "$PS1" in
      *'\e]133;B'*) ;;
      *) PS1="$PS1"'\[\e]133;B\a\]' ;;
    esac
    __pragma_si_ready=1
    return "$status"
  }

  PROMPT_COMMAND="__pragma_si_prompt_start"$'\n'"${PROMPT_COMMAND:+$PROMPT_COMMAND$'\n'}__pragma_si_prompt_end"

  if (( BASH_VERSINFO[0] > 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] >= 4) )); then
    PS0="${PS0-}"'\e]133;C\a'
  else
    # Bash before 4.4 has no PS0, so the DEBUG trap marks where a command starts.
    __pragma_si_debug() {
      [ "$__pragma_si_ready" = 1 ] || return 0
      [ -n "${COMP_LINE-}" ] && return 0
      case "$BASH_COMMAND" in __pragma_si_prompt_start*) return 0 ;; esac
      __pragma_si_ready=0
      builtin printf '\033]133;C\007'
    }
    if [ -z "$(trap -p DEBUG)" ]; then
      trap '__pragma_si_debug' DEBUG
    fi
  fi
fi
