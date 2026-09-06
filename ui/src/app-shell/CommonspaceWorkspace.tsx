import { LoaderCircleIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { CommonspaceConversation } from "../CommonspaceConversation.tsx";
import { CommonspaceDirectory } from "../CommonspaceDirectory.tsx";
import { CommonspaceInbox } from "../CommonspaceInbox.tsx";
import { CommonspaceProjectView } from "../CommonspaceProjectView.tsx";
import { CommonspaceThreads } from "../CommonspaceThreads.tsx";
import type {
	CommonspaceClientSnapshot,
	CommonspaceStore,
} from "../commonspace-store.ts";
import type { CommonspaceNavigation } from "./useCommonspaceNavigation.ts";

interface CommonspaceWorkspaceProps {
	navigation: CommonspaceNavigation;
	projectFetcher?: typeof globalThis.fetch;
	snapshot: CommonspaceClientSnapshot;
	store: CommonspaceStore;
}

function WorkspaceConnection({
	error,
	onRetry,
}: {
	error: string | null;
	onRetry: () => void;
}) {
	const failed = error !== null;
	return (
		<main
			aria-label="Workspace connection"
			className="flex h-full min-h-0 items-center justify-center overflow-y-auto bg-background p-8"
		>
			<Empty
				role={failed ? "alert" : "status"}
				className="max-w-md flex-none border border-solid bg-card px-8 py-10"
			>
				<EmptyHeader>
					<EmptyMedia variant="icon">
						{failed ? (
							<UnplugIcon aria-hidden="true" />
						) : (
							<LoaderCircleIcon
								aria-hidden="true"
								className="motion-safe:animate-spin"
							/>
						)}
					</EmptyMedia>
					<EmptyTitle>
						<h1>{failed ? "Workspace unavailable" : "Opening workspace"}</h1>
					</EmptyTitle>
					<EmptyDescription>
						{failed
							? "Check that Commonspace is running, then try again."
							: "Loading your conversations, projects, and agents…"}
					</EmptyDescription>
				</EmptyHeader>
				{failed && (
					<>
						<p className="max-w-full rounded-sm bg-muted px-3 py-2 text-xs leading-relaxed text-foreground [overflow-wrap:anywhere]">
							{error}
						</p>
						<Button variant="outline" onClick={onRetry}>
							<RefreshCwIcon data-icon="inline-start" aria-hidden="true" />
							Try again
						</Button>
					</>
				)}
			</Empty>
		</main>
	);
}

export function CommonspaceWorkspace({
	navigation,
	projectFetcher,
	snapshot,
	store,
}: CommonspaceWorkspaceProps) {
	const {
		activeDestination,
		activeProjectViewId,
		clearSettingsRequest,
		clearTargetMessage,
		composerInsertRequest,
		directoryKind,
		inboxViewRequest,
		messageUrl,
		navigationToken,
		openContextSettings,
		openConversation,
		openInbox,
		openProject,
		openThread,
		openTarget,
		requestCreate,
		settingsRequest,
		targetMessageId,
		targetProjectFile,
	} = navigation;

	if (snapshot.bootstrap === null) {
		return (
			<WorkspaceConnection
				error={snapshot.loading ? null : snapshot.error}
				onRetry={() => {
					void store.refresh();
				}}
			/>
		);
	}

	if (activeProjectViewId !== null) {
		const projectSettingsRequest =
			settingsRequest?.kind === "project" &&
			settingsRequest.id === activeProjectViewId
				? settingsRequest.token
				: undefined;
		return (
			<CommonspaceProjectView
				projectId={activeProjectViewId}
				navigationToken={navigationToken}
				targetFile={targetProjectFile}
				store={store}
				{...(projectFetcher === undefined ? {} : { fetcher: projectFetcher })}
				{...(projectSettingsRequest === undefined
					? {}
					: { settingsRequest: projectSettingsRequest })}
				onBack={openInbox}
				onOpenConversation={openConversation}
			/>
		);
	}

	if (activeDestination === "directory") {
		return (
			<CommonspaceDirectory
				key={directoryKind}
				kind={directoryKind}
				bootstrap={snapshot.bootstrap}
				store={store}
				onAdd={requestCreate}
				onOpenProject={openProject}
				onOpenConversation={openConversation}
				onOpenSettings={openContextSettings}
				onOpenSessions={() => openInbox("sessions")}
			/>
		);
	}

	if (activeDestination === "inbox") {
		return (
			<CommonspaceInbox
				store={store}
				onOpenItem={openTarget}
				viewRequest={inboxViewRequest}
			/>
		);
	}

	if (activeDestination === "threads") {
		return (
			<CommonspaceThreads
				bootstrap={snapshot.bootstrap}
				store={store}
				onOpenThread={openTarget}
			/>
		);
	}

	const conversationSettingsRequest =
		settingsRequest?.kind === "channel" || settingsRequest?.kind === "agent"
			? {
					kind: settingsRequest.kind,
					id: settingsRequest.id,
					token: settingsRequest.token,
				}
			: null;
	return (
		<CommonspaceConversation
			store={store}
			composerInsertRequest={composerInsertRequest}
			messageUrl={messageUrl}
			onOpenSettings={() => {
				const conversation = snapshot.activeConversation;
				if (conversation === null) return;
				openContextSettings(
					conversation.kind === "channel" ? "channel" : "agent",
					conversation.id,
				);
			}}
			onSettingsClosed={clearSettingsRequest}
			settingsRequest={conversationSettingsRequest}
			onThreadChange={openThread}
			targetMessageId={targetMessageId}
			onTargetMessageHandled={clearTargetMessage}
		/>
	);
}
