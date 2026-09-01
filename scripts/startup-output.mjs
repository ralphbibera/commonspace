const ansiEscape = String.fromCharCode(27);
const ansiSequence = new RegExp(`${ansiEscape}\\[[0-9;]*m`, "g");

export function stripAnsi(value) {
	return value.replace(ansiSequence, "");
}

export function findStartupUrl(output, pattern) {
	return stripAnsi(output).match(pattern)?.[1];
}
