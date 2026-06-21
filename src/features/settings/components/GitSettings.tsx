"use client";

import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";
import { SettingSection } from "./ui/SettingSection";
import { SettingRow } from "./ui/SettingRow";

export function GitSettings() {
  const { git, setGitSettings } = useSettingsStore();

  const resolvedSignOffText = git.signOffText
    .replace(/{name}/g, git.userName || "Name")
    .replace(/{email}/g, git.userEmail || "email@example.com");

  return (
    <div className="flex flex-col gap-6">
      <SettingSection title="Identity">
        <SettingRow
          label="User Name"
          description="Default author name for commits"
          control={
            <Input
              value={git.userName}
              onChange={(e) => setGitSettings({ userName: e.target.value })}
              placeholder="Ada Lovelace"
              className="max-w-[200px]"
            />
          }
        />
        <SettingRow
          label="User Email"
          description="Default author email for commits"
          control={
            <Input
              type="email"
              value={git.userEmail}
              onChange={(e) => setGitSettings({ userEmail: e.target.value })}
              placeholder="ada@example.com"
              className="max-w-[200px]"
            />
          }
        />
      </SettingSection>

      <SettingSection title="Commit">
        <SettingRow
          label="Append Sign-Off"
          description="Add a signed-off-by line to each commit"
          control={
            <Switch checked={git.signOff} onCheckedChange={(v) => setGitSettings({ signOff: v })} />
          }
        />
        <SettingRow
          label="Sign-Off Text"
          description={
            <>
              Preview: <span className="font-mono text-fg-muted">{resolvedSignOffText}</span>
            </>
          }
          control={
            <Input
              value={git.signOffText}
              onChange={(e) => setGitSettings({ signOffText: e.target.value })}
              placeholder="Signed-off-by: {name} <{email}>"
              disabled={!git.signOff}
              className="max-w-[260px]"
            />
          }
        />
        <SettingRow
          label="GPG Signing Key"
          description="Key ID or fingerprint for signed commits"
          control={
            <Input
              value={git.gpgSignKey}
              onChange={(e) => setGitSettings({ gpgSignKey: e.target.value })}
              placeholder="key ID or fingerprint"
              className="max-w-[200px]"
            />
          }
        />
        <SettingRow
          label="Pull with Rebase"
          description="Rebase local changes when pulling"
          control={
            <Switch
              checked={git.pullRebase}
              onCheckedChange={(v) => setGitSettings({ pullRebase: v })}
            />
          }
        />
      </SettingSection>

      <SettingSection title="Remote">
        <SettingRow
          label="Default Remote"
          description="Remote used for push and pull operations"
          control={
            <Input
              value={git.defaultRemote}
              onChange={(e) => setGitSettings({ defaultRemote: e.target.value })}
              placeholder="origin"
              className="max-w-[180px]"
            />
          }
        />
        <SettingRow
          label="SSH Key Path"
          description="Optional SSH key for authenticated remotes"
          control={
            <Input
              value={git.sshKeyPath}
              onChange={(e) => setGitSettings({ sshKeyPath: e.target.value })}
              placeholder="~/.ssh/id_ed25519"
              className="max-w-[260px]"
            />
          }
        />
      </SettingSection>
    </div>
  );
}
