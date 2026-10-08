# Pragma shell integration: loads the user's .zshenv while ZDOTDIR points at Pragma.
__pragma_si_zdotdir="$ZDOTDIR"
ZDOTDIR="${PRAGMA_USER_ZDOTDIR:-$HOME}"
if [[ -f "$ZDOTDIR/.zshenv" ]]; then
  builtin source "$ZDOTDIR/.zshenv"
fi
PRAGMA_USER_ZDOTDIR="$ZDOTDIR"
ZDOTDIR="$__pragma_si_zdotdir"
builtin unset __pragma_si_zdotdir
