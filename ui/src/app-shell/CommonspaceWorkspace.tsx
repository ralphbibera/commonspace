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
	snapshot: CommonspaceClientSnapshot;
	store: CommonspaceStore;
}

export function CommonspaceWorkspace({
	navigation,
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
		openContextSettings,
		openConversation,
		openInbox,
		openProject,
		openTarget,
		requestCreate,
		settingsRequest,
		targetMessageId,
		targetProjectFile,
	} = navigation;

	if (activeProjectViewId !== null) {
		const projectSettingsRequest =
			settingsRequest?.kind === "project" &&
			settingsRequest.id === activeProjectViewId
				? settingsRequest.token
				: undefined;
		return (
			<CommonspaceProjectView
				projectId={activeProjectViewId}
				targetFile={targetProjectFile}
				store={store}
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
			onSettingsClosed={clearSettingsRequest}
			settingsRequest={conversationSettingsRequest}
			targetMessageId={targetMessageId}
			onTargetMessageHandled={clearTargetMessage}
		/>
	);
}
