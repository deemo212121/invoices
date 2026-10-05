// Result returned by form actions and read with useActionState.
// `go` asks the form to open that page next (after saving a new record, for example).
export type FormState = { error?: string; ok?: string; go?: string };
