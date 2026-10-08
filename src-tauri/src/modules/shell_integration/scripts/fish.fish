# Pragma shell integration: marks prompts and commands with OSC 133.
if status is-interactive; and not set -q __pragma_si_loaded
    set -g __pragma_si_loaded 1

    function __pragma_si_preexec --on-event fish_preexec
        printf '\e]133;C\a'
    end

    function __pragma_si_postexec --on-event fish_postexec
        printf '\e]133;D;%s\a' $status
    end

    if functions -q fish_prompt
        functions -c fish_prompt __pragma_si_fish_prompt
        function fish_prompt
            printf '\e]133;A\a'
            __pragma_si_fish_prompt
            printf '\e]133;B\a'
        end
    end
end
