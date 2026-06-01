import { useState } from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Toggle } from "@/components/ui/toggle";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { CaretDown, CaretRight, Info } from "@phosphor-icons/react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg font-mono">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Showcase() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [sliderValue, setSliderValue] = useState([50]);
  const [switchChecked, setSwitchChecked] = useState(false);
  const [togglePressed, setTogglePressed] = useState(false);
  const [checkboxChecked, setCheckboxChecked] = useState(false);
  const [radioValue, setRadioValue] = useState("a");
  const [selectValue, setSelectValue] = useState("");
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");
  const [progressValue, setProgressValue] = useState(65);
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background text-foreground p-8">
        <div className="max-w-6xl mx-auto">
          <header className="mb-12 pb-6 border-b border-border">
            <h1 className="text-3xl font-mono font-bold tracking-tight">
              Pragma Component Showcase
            </h1>
            <p className="text-muted-foreground mt-2 font-mono text-sm">
              Alle verfuegbaren UI-Components. Warm Dark Theme — Pragma IDE.
            </p>
          </header>

          <Section title="Button">
            <div className="flex flex-wrap gap-3">
              <Button>Default</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="link">Link</Button>
              <Button size="sm">Small</Button>
              <Button size="lg">Large</Button>
              <Button disabled>Disabled</Button>
            </div>
          </Section>

          <Section title="ButtonGroup">
            <ButtonGroup>
              <Button>Left</Button>
              <Button>Middle</Button>
              <Button>Right</Button>
            </ButtonGroup>
          </Section>

          <Section title="Badge">
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>
          </Section>

          <Section title="Card">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card Description</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Card content goes here. Used for panels, settings, etc.
                </p>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button variant="ghost" size="sm">
                  Cancel
                </Button>
                <Button size="sm">Save</Button>
              </CardFooter>
            </Card>
          </Section>

          <Section title="Alert">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Heads up</AlertTitle>
              <AlertDescription>
                This is an alert — used for notifications or warnings in the IDE.
              </AlertDescription>
            </Alert>
          </Section>

          <Section title="Input">
            <div className="space-y-3 max-w-md">
              <Input
                placeholder="Type something..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <Input placeholder="Disabled" disabled />
            </div>
          </Section>

          <Section title="Textarea">
            <Textarea
              placeholder="Multi-line text input..."
              value={textareaValue}
              onChange={(e) => setTextareaValue(e.target.value)}
              className="max-w-md"
            />
          </Section>

          <Section title="Label + Checkbox">
            <div className="flex items-center space-x-3">
              <Checkbox id="terms" checked={checkboxChecked} onCheckedChange={setCheckboxChecked} />
              <Label htmlFor="terms">Accept terms and conditions</Label>
            </div>
          </Section>

          <Section title="Switch">
            <div className="flex items-center space-x-3">
              <Switch id="airplane" checked={switchChecked} onCheckedChange={setSwitchChecked} />
              <Label htmlFor="airplane">Airplane Mode</Label>
            </div>
          </Section>

          <Section title="RadioGroup">
            <RadioGroup value={radioValue} onValueChange={setRadioValue}>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="a" id="r1" />
                <Label htmlFor="r1">Option A</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="b" id="r2" />
                <Label htmlFor="r2">Option B</Label>
              </div>
            </RadioGroup>
          </Section>

          <Section title="Select">
            <Select value={selectValue} onValueChange={(v) => setSelectValue(v ?? "")}>
              <SelectTrigger className="max-w-md">
                <SelectValue placeholder="Select a fruit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apple">Apple</SelectItem>
                <SelectItem value="banana">Banana</SelectItem>
                <SelectItem value="orange">Orange</SelectItem>
              </SelectContent>
            </Select>
          </Section>

          <Section title="Slider">
            <div className="max-w-md space-y-2">
              <Slider
                value={sliderValue}
                onValueChange={(v) => setSliderValue(v as number[])}
                max={100}
                step={1}
              />
              <p className="text-sm text-zinc-400 font-mono">Value: {sliderValue[0]}</p>
            </div>
          </Section>

          <Section title="Progress">
            <div className="max-w-md space-y-3">
              <Progress value={progressValue} />
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setProgressValue((v) => Math.max(0, v - 10))}>
                  -10
                </Button>
                <Button size="sm" onClick={() => setProgressValue((v) => Math.min(100, v + 10))}>
                  +10
                </Button>
              </div>
            </div>
          </Section>

          <Section title="Tabs">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <p className="text-sm text-muted-foreground">Overview content</p>
              </TabsContent>
              <TabsContent value="settings">
                <p className="text-sm text-muted-foreground">Settings content</p>
              </TabsContent>
              <TabsContent value="logs">
                <p className="text-sm text-muted-foreground">Logs content</p>
              </TabsContent>
            </Tabs>
          </Section>

          <Section title="Dialog">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger>
                <Button>Open Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Dialog Title</DialogTitle>
                  <DialogDescription>
                    This is a dialog description. Used for modals in the IDE.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <Input placeholder="Some input inside dialog" />
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={() => setDialogOpen(false)}>Confirm</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </Section>

          <Section title="DropdownMenu">
            <DropdownMenu>
              <DropdownMenuTrigger>
                <Button variant="outline">Open Menu</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem>New File</DropdownMenuItem>
                <DropdownMenuItem>Open</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem>Preferences</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Section>

          <Section title="Popover">
            <Popover>
              <PopoverTrigger>
                <Button variant="outline">Open Popover</Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-2">
                  <h4 className="font-medium">Dimensions</h4>
                  <p className="text-sm text-zinc-400">Set the dimensions for the layer.</p>
                  <div className="flex gap-2">
                    <Input placeholder="Width" />
                    <Input placeholder="Height" />
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </Section>

          <Section title="Tooltip">
            <Tooltip>
              <TooltipTrigger>
                <Button variant="outline">Hover for Tooltip</Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>This is a tooltip</p>
              </TooltipContent>
            </Tooltip>
          </Section>

          <Section title="Collapsible">
            <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen}>
              <CollapsibleTrigger>
                <Button variant="ghost" className="flex items-center gap-2">
                  {collapsibleOpen ? (
                    <CaretDown className="h-4 w-4" />
                  ) : (
                    <CaretRight className="h-4 w-4" />
                  )}
                  Toggle Section
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <p className="text-sm text-muted-foreground mt-2 pl-6">
                  Hidden content revealed. Used for file explorer sections, settings groups, etc.
                </p>
              </CollapsibleContent>
            </Collapsible>
          </Section>

          <Section title="Accordion">
            <Accordion>
              <AccordionItem value="item-1">
                <AccordionTrigger>Is it accessible?</AccordionTrigger>
                <AccordionContent>Yes. It adheres to the WAI-ARIA design pattern.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2">
                <AccordionTrigger>Is it styled?</AccordionTrigger>
                <AccordionContent>
                  Yes. It comes with default styles that match the other components.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </Section>

          <Section title="ScrollArea">
            <ScrollArea className="h-32 w-64 rounded-md border border-border p-4">
              <div className="space-y-2">
                {Array.from({ length: 20 }).map((_, i) => (
                  <p key={i} className="text-sm font-mono">
                    Line {i + 1}
                  </p>
                ))}
              </div>
            </ScrollArea>
          </Section>

          <Section title="Separator">
            <div className="space-y-2">
              <p>Content above</p>
              <Separator />
              <p>Content below</p>
            </div>
          </Section>

          <Section title="Skeleton">
            <div className="space-y-3 max-w-md">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Section>

          <Section title="Toggle">
            <Toggle pressed={togglePressed} onPressedChange={setTogglePressed}>
              Bold
            </Toggle>
          </Section>

          <Section title="Kbd">
            <div className="flex gap-2">
              <Kbd>Ctrl</Kbd>
              <span>+</span>
              <Kbd>Shift</Kbd>
              <span>+</span>
              <Kbd>P</Kbd>
            </div>
          </Section>

          <Section title="Breadcrumb">
            <nav className="flex items-center space-x-2 text-sm">
              <Button variant="link" className="h-auto p-0">
                Home
              </Button>
              <CaretRight className="h-4 w-4 text-muted-foreground" />
              <Button variant="link" className="h-auto p-0">
                Settings
              </Button>
              <CaretRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">General</span>
            </nav>
          </Section>

          <Section title="Command (Cmd+K) — TODO">
            <p className="text-sm text-muted-foreground">
              Command Palette — wird spaeter als globaler Shortcut implementiert.
            </p>
          </Section>

          <Section title="ContextMenu — TODO">
            <p className="text-sm text-muted-foreground">
              Right-click context menu — wird fuer File Explorer implementiert.
            </p>
          </Section>

          <Section title="Menubar — TODO">
            <p className="text-sm text-muted-foreground">
              Top application menu bar — wird fuer die IDE Titlebar implementiert.
            </p>
          </Section>

          <Section title="Resizable — TODO">
            <p className="text-sm text-muted-foreground">
              Resizable panels — wird fuer Editor/Terminal Split implementiert.
            </p>
          </Section>

          <Section title="Sheet — TODO">
            <p className="text-sm text-muted-foreground">
              Slide-out panels — wird fuer mobile Sidebar oder Settings verwendet.
            </p>
          </Section>

          <Section title="Sonner (Toasts) — TODO">
            <p className="text-sm text-muted-foreground">
              Toast notifications — wird fuer Build-Status, Git-Operationen, etc. verwendet.
            </p>
          </Section>

          <Section title="HoverCard — TODO">
            <p className="text-sm text-muted-foreground">
              Hover cards — wird fuer Git-Commit-Preview, Type-Info, etc. verwendet.
            </p>
          </Section>

          <div className="mt-12 pt-6 border-t border-border text-center text-muted-foreground text-sm font-mono">
            End of Component Showcase — Pragma IDE
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default Showcase;
