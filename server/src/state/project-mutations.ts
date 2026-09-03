import type {
	CommonspaceMessage,
	CommonspaceMutation,
	CommonspaceState,
} from "@commonspace/shared";
import { projectTagName, referencedProjectIds } from "@commonspace/shared";

type CreateProjectMutation = Extract<
	CommonspaceMutation,
	{ action: "create-project" }
>;
type AddProjectPathMutation = Extract<
	CommonspaceMutation,
	{ action: "add-project-path" }
>;
type RemoveProjectMutation = Extract<
	CommonspaceMutation,
	{ action: "remove-project" }
>;
export type ProjectMutation =
	| CreateProjectMutation
	| AddProjectPathMutation
	| RemoveProjectMutation;

export interface ProjectMutationDependencies {
	ids(): string;
	now(): string;
}

function nextRevision(state: CommonspaceState): number {
	return Math.max(0, state.revision) + 1;
}

function normalizedProjectName(value: string): string {
	const name = value.normalize("NFKC").trim().replace(/\s+/g, " ").slice(0, 80);
	if (name === "") throw new Error("project name is required");
	return name;
}

function createProject(
	state: CommonspaceState,
	mutation: CreateProjectMutation,
	dependencies: ProjectMutationDependencies,
): CommonspaceState {
	const name = normalizedProjectName(mutation.name);
	const tagName = projectTagName(name);
	if (
		state.projects.some((project) => projectTagName(project.name) === tagName)
	) {
		throw new Error("project name already exists");
	}
	const paths = [
		...new Set(mutation.paths.map((path) => path.trim()).filter(Boolean)),
	];
	if (paths.length === 0)
		throw new Error("project requires at least one filesystem path");
	return {
		...state,
		revision: nextRevision(state),
		projects: [
			...state.projects,
			{
				id: dependencies.ids(),
				name,
				paths,
				createdAt: dependencies.now(),
			},
		],
	};
}

function addProjectPath(
	state: CommonspaceState,
	mutation: AddProjectPathMutation,
): CommonspaceState {
	const path = mutation.path.trim();
	if (path === "") throw new Error("project path is required");
	const project = state.projects.find(
		(candidate) => candidate.id === mutation.projectId,
	);
	if (project === undefined) throw new Error("unknown project");
	if (project.paths.includes(path)) return state;
	return {
		...state,
		revision: nextRevision(state),
		projects: state.projects.map((candidate) =>
			candidate.id === mutation.projectId
				? { ...candidate, paths: [...candidate.paths, path] }
				: candidate,
		),
	};
}

function removeProjectReference(
	message: CommonspaceMessage,
	projectId: string,
): CommonspaceMessage {
	const previousProjectIds = referencedProjectIds(message);
	const projectIds = previousProjectIds.filter((id) => id !== projectId);
	const updated = { ...message };
	const primaryProjectId = projectIds[0];
	if (primaryProjectId === undefined) {
		delete updated.projectIds;
		delete updated.projectId;
	} else {
		updated.projectIds = projectIds;
		updated.projectId = primaryProjectId;
	}
	if (updated.runAttribution === undefined) return updated;
	const roots =
		previousProjectIds.length === 1 && previousProjectIds[0] === projectId
			? []
			: updated.runAttribution.roots.filter(
					(root) => root.projectId !== projectId,
				);
	if (roots.length === 0) delete updated.runAttribution;
	else updated.runAttribution = { ...updated.runAttribution, roots };
	return updated;
}

function removeProject(
	state: CommonspaceState,
	mutation: RemoveProjectMutation,
): CommonspaceState {
	if (!state.projects.some((project) => project.id === mutation.projectId))
		return state;
	return {
		...state,
		revision: nextRevision(state),
		projects: state.projects.filter(
			(project) => project.id !== mutation.projectId,
		),
		threads: state.threads.map((thread) => {
			const projectIds = referencedProjectIds(thread).filter(
				(projectId) => projectId !== mutation.projectId,
			);
			return { ...thread, projectIds, projectId: projectIds[0] ?? null };
		}),
		messages: Object.fromEntries(
			Object.entries(state.messages).map(([key, messages]) => [
				key,
				messages.map((message) =>
					removeProjectReference(message, mutation.projectId),
				),
			]),
		),
	};
}

export function applyProjectMutation(
	state: CommonspaceState,
	mutation: ProjectMutation,
	dependencies: ProjectMutationDependencies,
): CommonspaceState {
	switch (mutation.action) {
		case "create-project":
			return createProject(state, mutation, dependencies);
		case "add-project-path":
			return addProjectPath(state, mutation);
		case "remove-project":
			return removeProject(state, mutation);
	}
}
