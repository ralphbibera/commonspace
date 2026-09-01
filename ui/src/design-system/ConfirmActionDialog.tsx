import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmActionDialogProps {
	open: boolean;
	title: string;
	description: string;
	actionLabel?: string;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void | Promise<void>;
}

export function ConfirmActionDialog({
	open,
	title,
	description,
	actionLabel = "Remove",
	onOpenChange,
	onConfirm,
}: ConfirmActionDialogProps) {
	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent className="max-w-[460px] gap-0 rounded-md p-0 ring-1 ring-border shadow-[var(--shadow-high)] sm:max-w-[460px]">
				<AlertDialogHeader className="place-items-start gap-2 px-[18px] py-5 text-left">
					<AlertDialogTitle className="font-heading text-xl font-bold">
						{title}
					</AlertDialogTitle>
					<AlertDialogDescription className="max-w-[390px] text-[13px] leading-5">
						{description}
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter className="m-0 flex-row justify-end rounded-none rounded-b-md bg-muted px-[18px] py-3">
					<AlertDialogCancel className="min-h-11 rounded-sm">
						Cancel
					</AlertDialogCancel>
					<AlertDialogAction
						variant="destructive"
						className="min-h-11 rounded-sm"
						onClick={() => {
							void Promise.resolve(onConfirm()).then(() => {
								onOpenChange(false);
							});
						}}
					>
						{actionLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
