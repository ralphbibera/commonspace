import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";
import { cn } from "@/lib/utils";

interface ResizablePanelHandleProps {
	ariaLabel: string;
	value: number;
	min: number;
	max: number;
	step?: number;
	className?: string;
	style?: CSSProperties;
	onChange: (value: number) => void;
	onStartResize: () => void;
	onReset: () => void;
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

export function ResizablePanelHandle({
	ariaLabel,
	value,
	min,
	max,
	step = 5,
	className,
	style,
	onChange,
	onStartResize,
	onReset,
}: ResizablePanelHandleProps) {
	const onKeyDown = (event: KeyboardEvent<HTMLHRElement>) => {
		if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
		event.preventDefault();
		onChange(
			clamp(value + (event.key === "ArrowLeft" ? step : -step), min, max),
		);
	};
	const onPointerDown = (event: PointerEvent<HTMLHRElement>) => {
		event.preventDefault();
		onStartResize();
	};

	return (
		<hr
			className={cn(
				"commonspace-panel-resizer h-full w-2 cursor-col-resize border-0 bg-transparent after:absolute after:inset-y-0 after:left-[3px] after:w-px after:bg-border hover:after:w-0.5 hover:after:bg-primary",
				className,
			)}
			style={style}
			aria-label={ariaLabel}
			aria-orientation="vertical"
			aria-valuemin={min}
			aria-valuemax={max}
			aria-valuenow={value}
			tabIndex={0}
			onDoubleClick={onReset}
			onPointerDown={onPointerDown}
			onKeyDown={onKeyDown}
		/>
	);
}
