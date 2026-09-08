const CREDENTIAL_FILE_NAMES = new Set([
	".netrc",
	".npmrc",
	".pypirc",
	"credentials",
	"credentials.json",
	"id_dsa",
	"id_ecdsa",
	"id_ed25519",
	"id_rsa",
]);

export function credentialBearingFileName(name: string): boolean {
	const lowerName = name.normalize("NFKC").toLocaleLowerCase();
	return (
		lowerName === ".env" ||
		lowerName.startsWith(".env.") ||
		CREDENTIAL_FILE_NAMES.has(lowerName) ||
		/^(?:id_ed25519|id_rsa|credentials?|secrets?|tokens?)(?:\.|$)/u.test(
			lowerName,
		) ||
		/^(?:auth|credential|credentials|secret|secrets)(?:\.[^.]+)*$/u.test(
			lowerName,
		) ||
		/^service[-_]?account.+\.json$/u.test(lowerName) ||
		/(?:^|[._-])(?:service-account|credentials?|secrets?|tokens?)(?:[._-]|$)/u.test(
			lowerName,
		) ||
		/\.(?:key|pem|p12|pfx|kdbx)$/u.test(lowerName)
	);
}
