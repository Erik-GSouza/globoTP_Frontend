import type { ValidatorFn } from "@angular/forms"

export const requiredText: ValidatorFn = (control) =>
  typeof control.value === "string" && control.value.trim().length > 0
    ? null
    : { required: true }
