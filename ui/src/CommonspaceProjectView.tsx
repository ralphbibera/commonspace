import type {
	CommonspaceBootstrap,
	CommonspaceProject,
	CommonspaceState,
	ConversationRef,
} from "@commonspace/shared";
import { referencedProjectIds } from "@commonspace/shared";
import { ArrowLeftIcon, FolderPlusIcon, SettingsIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommonspaceLogo } from "@/design-system/CommonspaceLogo";
import { ConfirmActionDialog } from "@/design-system/ConfirmActionDialog";
import { WorkspaceHeader } from "@/design-system/WorkspaceHeader";
import { CommonspaceProjectChanges } from "./CommonspaceProjectChanges.tsx";
import { CommonspaceProjectFiles } from "./CommonspaceProjectFiles.tsx";
import type { CommonspaceStore } from "./commonspace-store.ts";
import { AgentAvatar } from "./design-system/AgentAvatar.tsx";

export interface CommonspaceProjectViewProps {
	projectId: string;
	targetFile?: { rootIndex: number; path: string } | null;
	settingsRequest?: number;
	store: CommonspaceStore;
	onBack: () => void;
	onOpenConversation: (conversation: ConversationRef) => void;
	fetcher?: typeof globalThis.fetch;
}

type ProjectTab = "conversations" | "files" | "changes";

function conversationReferencesProject(
	state: CommonspaceState,
	conversation: ConversationRef,
	projectId: string,
): boolean {
	return (state.messages[`${conversation.kind}:${conversation.id}`] ?? []).some(
		(message) => referencedProjectIds(message).includes(projectId),
	);
}

function ProjectConversations({
	bootstrap,
	state,
	project,
	onOpenConversation,
}: {
	bootstrap: CommonspaceBootstrap;
	state: CommonspaceState;
	project: CommonspaceProject;
	onOpenConversation: (conversation: ConversationRef) => void;
}) {
	const channels = state.channels.filter((channel) =>
		conversationReferencesProject(
			state,
			{ kind: "channel", id: channel.id },
			project.id,
		),
	);
	const directMessages = bootstrap.agents.filter((agent) =>
		conversationReferencesProject(
			state,
			{ kind: "dm", id: agent.id },
			project.id,
		),
	);
	const conversationCount = channels.length + directMessages.length;
	return (
		<section
			className="mx-auto max-w-[920px] overflow-hidden rounded-md border bg-background"
			aria-labelledby="project-conversations-heading"
		>
			<header className="border-b px-[18px] py-3.5">
				<strong
					id="project-conversations-heading"
					className="block text-[17px]"
				>
					Conversations
				</strong>
				<small className="mt-1 block text-xs text-muted-foreground">
					{project.name} · real workspace conversations
				</small>
			</header>
			<div>
				{channels.map((channel) => {
					const latest = state.messages[`channel:${channel.id}`]?.findLast(
						(message) => referencedProjectIds(message).includes(project.id),
					);
					return (
						<button
							key={`channel:${channel.id}`}
							type="button"
							className="grid min-h-[82px] w-full grid-cols-[34px_minmax(0,1fr)_20px] items-center gap-3 border-0 border-b bg-transparent px-4 py-2.5 text-left last:border-b-0 hover:bg-muted"
							aria-label={`Open channel ${channel.name}`}
							onClick={() =>
								onOpenConversation({ kind: "channel", id: channel.id })
							}
						>
							<span
								className="grid size-[34px] place-items-center rounded-sm border bg-muted font-mono"
								aria-hidden="true"
							>
								#
							</span>
							<span className="min-w-0">
								<strong className="block truncate"># {channel.name}</strong>
								<small className="block truncate text-xs text-muted-foreground">
									Global Channel · references {project.name}
								</small>
								<p className="mt-1 truncate text-[13px]">
									{latest?.text ??
										(channel.instructions.trim() || "No messages yet.")}
								</p>
							</span>
							<span className="text-muted-foreground" aria-hidden="true">
								→
							</span>
						</button>
					);
				})}
				{directMessages.map((agent) => {
					const latest = state.messages[`dm:${agent.id}`]?.findLast((message) =>
						referencedProjectIds(message).includes(project.id),
					);
					return (
						<button
							key={`dm:${agent.id}`}
							type="button"
							className="grid min-h-[82px] w-full grid-cols-[34px_minmax(0,1fr)_20px] items-center gap-3 border-0 border-b bg-transparent px-4 py-2.5 text-left last:border-b-0 hover:bg-muted"
							aria-label={`Open direct message ${agent.displayName}`}
							onClick={() => onOpenConversation({ kind: "dm", id: agent.id })}
						>
							<AgentAvatar
								agent={agent}
								size="activity"
								className="rounded-full bg-primary text-primary-foreground"
							/>
							<span className="min-w-0">
								<strong className="block truncate">{agent.displayName}</strong>
								<small className="block truncate text-xs text-muted-foreground">
									Agent DM · selected project context
								</small>
								<p className="mt-1 truncate text-[13px]">
									{latest?.text ?? "No messages yet."}
								</p>
							</span>
							<span className="text-muted-foreground" aria-hidden="true">
								→
							</span>
						</button>
					);
				})}
				{conversationCount === 0 && (
					<div className="p-10 text-center text-sm text-muted-foreground">
						No conversations are connected to this project yet.
					</div>
				)}
			</div>
			<div className="border-t px-4 py-3 text-xs text-muted-foreground">
				{conversationCount}{" "}
				{conversationCount === 1 ? "conversation" : "conversations"} available
				in {project.name}
			</div>
		</section>
	);
}

export function CommonspaceProjectView({
	projectId,
	targetFile,
	settingsRequest,
	store,
	onBack,
	onOpenConversation,
	fetcher = globalThis.fetch,
}: CommonspaceProjectViewProps) {
	const [activeTab, setActiveTab] = useState<ProjectTab>("files");
	const [addingFolder, setAddingFolder] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);
	const snapshot = useSyncExternalStore(
		store.subscribe,
		store.getSnapshot,
		store.getSnapshot,
	);
	const bootstrap = snapshot.bootstrap;
	const state = bootstrap?.state;
	const project = state?.projects.find(
		(candidate) => candidate.id === projectId,
	);

	useEffect(() => {
		if (settingsRequest !== undefined) setSettingsOpen(true);
	}, [settingsRequest]);

	const addLocalFolder = async () => {
		setAddingFolder(true);
		try {
			const path = await store.selectDirectory();
			if (path !== null)
				await store.mutate({ action: "add-project-path", projectId, path });
		} catch {
			// Store exposes picker and mutation failures through its shared error state.
		} finally {
			setAddingFolder(false);
		}
	};

	if (project === undefined || state === undefined || bootstrap === null) {
		return (
			<main
				className="flex h-full min-h-0 flex-col bg-background"
				aria-label="Project unavailable"
			>
				<header className="flex min-h-16 items-center border-b px-6">
					<div>
						<h1 className="font-heading text-lg font-bold">
							Project unavailable
						</h1>
						<p className="mt-0.5 text-xs text-muted-foreground">
							Selected local context could not be found.
						</p>
					</div>
				</header>
				<div className="grid flex-1 place-items-center">
					<Button variant="outline" onClick={onBack}>
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						Back to Workspace
					</Button>
				</div>
			</main>
		);
	}

	const channels = state.channels.filter((channel) =>
		conversationReferencesProject(
			state,
			{ kind: "channel", id: channel.id },
			project.id,
		),
	);
	const directMessageCount = bootstrap.agents.filter((agent) =>
		conversationReferencesProject(
			state,
			{ kind: "dm", id: agent.id },
			project.id,
		),
	).length;
	const conversationCount = channels.length + directMessageCount;
	const folderCount = project.paths.length;
	const folderSummary =
		folderCount === 1
			? "1 folder · working directory"
			: `${String(folderCount)} folders · working + references`;
	return (
		<main className="h-full min-h-0" aria-label={`Project ${project.name}`}>
			<Tabs
				value={activeTab}
				onValueChange={(value) => {
					if (
						value === "conversations" ||
						value === "files" ||
						value === "changes"
					)
						setActiveTab(value);
				}}
				className="relative flex h-full min-h-0 flex-col gap-0 overflow-hidden bg-background"
			>
				<WorkspaceHeader
					title={project.name}
					subtitle={`${String(conversationCount)} ${conversationCount === 1 ? "conversation" : "conversations"} · ${folderSummary}`}
					mark={
						project.name.toLocaleLowerCase() === "commonspace" ? (
							<CommonspaceLogo decorative className="size-5" />
						) : (
							project.name.slice(0, 1).toLocaleUpperCase()
						)
					}
					actions={
						<button
							type="button"
							className="grid size-11 place-items-center rounded-full border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
							aria-label="Open project settings"
							aria-expanded={settingsOpen}
							onClick={() => {
								setSettingsOpen((open) => !open);
							}}
						>
							<SettingsIcon className="size-[18px]" aria-hidden="true" />
						</button>
					}
				/>
				<nav
					className="flex min-h-16 shrink-0 items-center gap-2.5 overflow-x-auto border-b px-5 py-2 whitespace-nowrap max-[780px]:px-3"
					aria-label="Project views"
				>
					<Button variant="ghost" onClick={onBack}>
						<ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
						Workspace
					</Button>
					<TabsList variant="project" aria-label="Project views">
						{(["conversations", "files", "changes"] as const).map((tab) => (
							<TabsTrigger key={tab} value={tab}>
								{tab.slice(0, 1).toLocaleUpperCase()}
								{tab.slice(1)}
							</TabsTrigger>
						))}
					</TabsList>
					<span className="flex-1" />
					<Button
						variant="outline"
						aria-label="Add local folder"
						disabled={addingFolder}
						onClick={() => {
							void addLocalFolder();
						}}
					>
						<FolderPlusIcon data-icon="inline-start" aria-hidden="true" />
						{addingFolder ? "Choosing…" : "Add context folder"}
					</Button>
					<Badge variant="outline">Files read only</Badge>
				</nav>
				<TabsContent
					value="conversations"
					className="min-h-0 flex-1 overflow-auto bg-muted p-6"
				>
					<ProjectConversations
						bootstrap={bootstrap}
						state={state}
						project={project}
						onOpenConversation={onOpenConversation}
					/>
				</TabsContent>
				<TabsContent
					value="files"
					className="min-h-0 flex-1 overflow-hidden bg-background"
				>
					<CommonspaceProjectFiles
						projectId={project.id}
						roots={project.paths}
						targetFile={targetFile ?? null}
						fetcher={fetcher}
					/>
				</TabsContent>
				<TabsContent
					value="changes"
					className="min-h-0 flex-1 overflow-hidden bg-background"
				>
					<CommonspaceProjectChanges projectId={project.id} fetcher={fetcher} />
				</TabsContent>
				{settingsOpen && (
					<aside
						className="absolute top-16 right-0 bottom-0 z-20 flex w-[min(420px,100%)] flex-col border-l bg-background shadow-[-20px_0_48px_color-mix(in_oklch,var(--foreground)_9%,transparent)]"
						aria-label="Project settings"
					>
						<header className="flex min-h-[70px] items-center gap-3 border-b py-2.5 pr-3.5 pl-5">
							<div className="min-w-0 flex-1">
								<h2 className="truncate font-heading text-[17px] font-bold">
									{project.name}
								</h2>
								<p className="mt-0.5 text-xs text-muted-foreground">
									{conversationCount}{" "}
									{conversationCount === 1 ? "conversation" : "conversations"} ·{" "}
									{folderSummary}
								</p>
							</div>
							<button
								type="button"
								className="grid size-8 shrink-0 place-items-center rounded-sm border-0 bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
								aria-label="Close project settings"
								onClick={() => {
									setSettingsOpen(false);
								}}
							>
								×
							</button>
						</header>
						<div className="min-h-0 flex-1 overflow-y-auto p-5">
							<section>
								<h3 className="mb-3 font-heading text-sm font-bold">
									Local context
								</h3>
								<div className="rounded-md border bg-muted p-4">
									<strong className="block text-[13px]">
										{project.paths[0] === undefined
											? "No working folder"
											: `Working · ${project.paths[0].split("/").at(-1) ?? project.name}`}
									</strong>
									<span className="mt-1 block text-xs text-muted-foreground">
										Read-only project browser
									</span>
								</div>
								<button
									type="button"
									className="mt-3 min-h-11 rounded-sm border bg-background px-4 font-semibold hover:bg-muted"
									onClick={() => {
										void addLocalFolder();
									}}
								>
									Add context folder
								</button>
							</section>
							<section className="mt-7 border-t pt-6">
								<h3 className="mb-3 font-heading text-sm font-bold">
									Connected work
								</h3>
								<div className="rounded-md border bg-muted p-4">
									<strong className="block text-[13px]">
										{conversationCount}{" "}
										{conversationCount === 1 ? "conversation" : "conversations"}
									</strong>
									<span className="mt-1 block text-xs text-muted-foreground">
										Channels and direct sessions using this context
									</span>
								</div>
							</section>
							<section className="mt-7 border-t pt-6">
								<h3 className="mb-3 font-heading text-sm font-bold">
									Danger zone
								</h3>
								<button
									type="button"
									className="min-h-11 rounded-sm border border-destructive/40 bg-background px-4 font-semibold text-destructive hover:bg-destructive/5"
									onClick={() => {
										setRemoveConfirmOpen(true);
									}}
								>
									Remove project
								</button>
							</section>
						</div>
					</aside>
				)}
				<ConfirmActionDialog
					open={removeConfirmOpen}
					title={`Remove ${project.name}?`}
					description="This can be added again later. Conversations keep their transcript while this local folder context is removed."
					onOpenChange={setRemoveConfirmOpen}
					onConfirm={async () => {
						await store.mutate({
							action: "remove-project",
							projectId: project.id,
						});
						onBack();
					}}
				/>
			</Tabs>
		</main>
	);
}
