import { CaretDown, Spinner, Terminal, Warning } from "@phosphor-icons/react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";

import { currentModelName, sortConfigOptions, type AcpConfigOption } from "./sessionOptions";
import type { CliSessionOptions } from "./useCliSessionOptions";

function OptionChoices({
  option,
  onSelect,
}: {
  option: AcpConfigOption;
  onSelect: (value: string) => void;
}) {
  return (
    <DropdownMenuRadioGroup
      value={option.currentValue}
      onValueChange={(value) => onSelect(String(value))}
    >
      {option.options.map((choice) => (
        <DropdownMenuRadioItem
          key={choice.value}
          value={choice.value}
          title={choice.description ?? undefined}
        >
          <span className="truncate">{choice.name}</span>
        </DropdownMenuRadioItem>
      ))}
    </DropdownMenuRadioGroup>
  );
}

/// Model, effort and mode picker for a coding CLI session; every value comes from the CLI itself.
export function CliSessionOptionsMenu({ session }: { session: CliSessionOptions }) {
  const options = sortConfigOptions(session.options);
  const model = options.find((option) => option.category === "model");
  const others = options.filter((option) => option !== model);
  const label = currentModelName(options) ?? session.providerName;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            title={`${session.providerName} / ${label}`}
            className="inline-flex h-7 min-w-0 max-w-[170px] items-center gap-1.5 rounded-full px-2.5 text-ui-xs font-medium text-fg-muted transition-colors outline-none hover:bg-bg-hover hover:text-fg-default focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            {session.loading ? (
              <Spinner size={13} className="shrink-0 animate-spin" />
            ) : (
              <Terminal size={13} className="shrink-0" />
            )}
            <span className="min-w-0 max-w-[110px] truncate">{label}</span>
            <CaretDown size={10} className="shrink-0 text-fg-subtle" />
          </button>
        }
      />
      <DropdownMenuContent align="start" side="top" sideOffset={6} className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{model ? model.name : session.providerName}</DropdownMenuLabel>

          {session.error && (
            <div className="flex items-start gap-1.5 px-2 py-1.5 text-ui-2xs text-status-error">
              <Warning size={12} className="mt-px shrink-0" />
              <span className="min-w-0 break-words">{session.error}</span>
            </div>
          )}

          {options.length === 0 && !session.error && (
            <div className="px-2 py-1.5 text-ui-2xs text-fg-subtle">
              {session.loading ? "Asking the CLI for its models…" : "This CLI reports no options."}
            </div>
          )}

          {model && (
            <OptionChoices
              option={model}
              onSelect={(value) => session.setOption(model.id, value)}
            />
          )}
        </DropdownMenuGroup>

        {others.length > 0 && <DropdownMenuSeparator />}
        {others.map((option) => (
          <DropdownMenuSub key={option.id}>
            <DropdownMenuSubTrigger title={option.description ?? undefined}>
              <span className="flex-1 truncate">{option.name}</span>
              <span className="max-w-[80px] truncate text-ui-2xs text-fg-subtle">
                {option.options.find((choice) => choice.value === option.currentValue)?.name ??
                  option.currentValue}
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <OptionChoices
                option={option}
                onSelect={(value) => session.setOption(option.id, value)}
              />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
