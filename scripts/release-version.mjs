export function parseReleaseVersion(version) {
	const match =
		typeof version === "string"
			? /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/u.exec(
					version,
				)
			: null;
	if (match === null || match[0] !== version) {
		throw new Error(
			"Release version must be a semantic version without a v prefix",
		);
	}
	return { version, prerelease: match[4] !== undefined };
}
