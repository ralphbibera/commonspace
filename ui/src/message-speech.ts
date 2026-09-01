import { useCallback, useEffect, useRef, useState } from "react";

function sentence(text: string): string {
	const trimmed = text.trim();
	if (trimmed === "" || /[.!?…:]$/.test(trimmed)) return trimmed;
	return `${trimmed}.`;
}

export function prepareMessageForSpeech(markdown: string): string {
	const prose = markdown
		.replace(
			/(^|\n)(```|~~~)[^\n]*\n[\s\S]*?\n\2(?=\n|$)/g,
			"$1Code block omitted.",
		)
		.replace(/(^|\n)(```|~~~)[^\n]*(?:\n[\s\S]*)?$/g, "$1Code block omitted.")
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_, alt: string) =>
			alt.trim() === "" ? "" : `Image: ${alt}.`,
		)
		.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.replace(/https?:\/\/[^\s)\]]+/gi, "link omitted")
		.split("\n")
		.map((line) => {
			const trimmed = line.trim();
			if (/^\|?(?:\s*:?-{3,}:?\s*\|)+\s*$/.test(trimmed)) return "";
			if (trimmed.includes("|") && /^\|.*\|$/.test(trimmed)) {
				return sentence(
					trimmed
						.split("|")
						.map((cell) => cell.trim())
						.filter(Boolean)
						.join(", "),
				);
			}
			const heading = trimmed.match(/^#{1,6}\s+(.+)$/);
			if (heading !== null) return sentence(heading[1] ?? "");
			const listItem = trimmed.match(/^(?:[-+*]|\d+[.)])\s+(.+)$/);
			if (listItem !== null) return sentence(listItem[1] ?? "");
			return trimmed.replace(/^>\s?/, "");
		})
		.join("\n")
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\*\*|__|~~/g, "")
		.replace(/(^|[\s([{])[*_]([^*_\n]+)[*_](?=$|[\s.,!?;:)\]}])/g, "$1$2")
		.replace(/<[^>]+>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

	return prose.length > 1 ? prose : "";
}

export interface MessageSpeechControls {
	activeMessageId: string | null;
	supported: boolean;
	toggle: (messageId: string, markdown: string) => void;
}

export function useMessageSpeech(
	scopeKey: string | null,
): MessageSpeechControls {
	const supported =
		typeof window !== "undefined" &&
		typeof window.speechSynthesis !== "undefined" &&
		typeof window.SpeechSynthesisUtterance !== "undefined";
	const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
	const activeMessageRef = useRef<string | null>(null);
	const generation = useRef(0);

	const clear = useCallback(() => {
		generation.current += 1;
		activeMessageRef.current = null;
		setActiveMessageId(null);
	}, []);

	const stop = useCallback(() => {
		if (!supported) return;
		window.speechSynthesis.cancel();
		clear();
	}, [clear, supported]);

	const toggle = useCallback(
		(messageId: string, markdown: string) => {
			if (!supported) return;
			if (activeMessageRef.current === messageId) {
				stop();
				return;
			}

			const text = prepareMessageForSpeech(markdown);
			if (text === "") return;

			generation.current += 1;
			const requestGeneration = generation.current;
			window.speechSynthesis.cancel();
			const utterance = new window.SpeechSynthesisUtterance(text);
			const finish = () => {
				if (generation.current !== requestGeneration) return;
				activeMessageRef.current = null;
				setActiveMessageId(null);
			};
			utterance.onend = finish;
			utterance.onerror = finish;
			activeMessageRef.current = messageId;
			setActiveMessageId(messageId);
			try {
				window.speechSynthesis.speak(utterance);
			} catch {
				finish();
			}
		},
		[stop, supported],
	);

	useEffect(() => {
		void scopeKey;
		if (activeMessageRef.current !== null) stop();
		return () => {
			generation.current += 1;
			if (supported) window.speechSynthesis.cancel();
		};
	}, [scopeKey, stop, supported]);

	return { activeMessageId, supported, toggle };
}
