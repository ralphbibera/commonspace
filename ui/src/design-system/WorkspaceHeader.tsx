import type { ReactNode } from "react";

export interface WorkspaceHeaderProps {
	title: string;
	subtitle?: string;
	mark: ReactNode;
	actions?: ReactNode;
}

export function WorkspaceHeader({
	title,
	subtitle,
	mark,
	actions,
}: WorkspaceHeaderProps) {
	return (
		<header className="flex min-h-16 items-center gap-3 border-b bg-background py-2 pr-[14px] pl-[18px] max-[780px]:pl-[60px]">
			<span
				className="grid size-7 shrink-0 place-items-center rounded-sm border bg-muted font-mono text-sm font-semibold text-muted-foreground"
				aria-hidden="true"
			>
				{mark}
			</span>
			<div className="min-w-0 flex-1">
				<h1 className="truncate font-heading text-[17px] font-semibold leading-tight tracking-[-0.01em]">
					{title}
				</h1>
				{subtitle === undefined ? null : (
					<p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
						{subtitle}
					</p>
				)}
			</div>
			{actions}
		</header>
	);
}
