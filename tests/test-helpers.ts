export function mustExist<Value>(
	value: Value | null | undefined,
	label = "expected value",
): Value {
	if (value === undefined || value === null)
		throw new Error(`${label} is missing`);
	return value;
}
