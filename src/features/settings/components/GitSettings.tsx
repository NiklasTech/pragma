"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Switch } from "@/shared/components/ui/switch";
import { useSettingsStore } from "@/shared/stores/settings";

export function GitSettings() {
  const { git, setGitSettings } = useSettingsStore();

  const resolvedSignOffText = git.signOffText
    .replace(/{name}/g, git.userName || "Name")
    .replace(/{email}/g, git.userEmail || "email@example.com");

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Author</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>User Name</Label>
            <Input
              value={git.userName}
              onChange={(e) => setGitSettings({ userName: e.target.value })}
              placeholder="Ada Lovelace"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>User Email</Label>
            <Input
              type="email"
              value={git.userEmail}
              onChange={(e) => setGitSettings({ userEmail: e.target.value })}
              placeholder="ada@example.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Commit Behavior</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="git-sign-off">
              Append Sign-Off
            </Label>
            <Switch
              id="git-sign-off"
              checked={git.signOff}
              onCheckedChange={(v) => setGitSettings({ signOff: v })}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Sign-Off Text</Label>
            <Input
              value={git.signOffText}
              onChange={(e) => setGitSettings({ signOffText: e.target.value })}
              placeholder="Signed-off-by: {name} <{email}>"
              disabled={!git.signOff}
            />
            <p className="text-ui-xs text-fg-subtle">
              Preview: <span className="font-mono text-fg-muted">{resolvedSignOffText}</span>
            </p>
          </div>

          <div className="flex items-center justify-between">
            <Label className="cursor-pointer" htmlFor="git-pull-rebase">
              Pull with Rebase
            </Label>
            <Switch
              id="git-pull-rebase"
              checked={git.pullRebase}
              onCheckedChange={(v) => setGitSettings({ pullRebase: v })}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Authentication</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Default Remote</Label>
            <Input
              value={git.defaultRemote}
              onChange={(e) => setGitSettings({ defaultRemote: e.target.value })}
              placeholder="origin"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>GPG Signing Key (optional)</Label>
            <Input
              value={git.gpgSignKey}
              onChange={(e) => setGitSettings({ gpgSignKey: e.target.value })}
              placeholder="key ID or fingerprint"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>SSH Key Path (optional)</Label>
            <Input
              value={git.sshKeyPath}
              onChange={(e) => setGitSettings({ sshKeyPath: e.target.value })}
              placeholder="~/.ssh/id_ed25519"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
