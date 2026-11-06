import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from "@angular/core"
import {
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from "@angular/forms"
import { Router } from "@angular/router"
import { ApiClient } from "../../core/api-client.service"

@Component({
  selector: "tp-login",
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: "./login.component.html",
  styleUrl: "./login.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  private readonly builder = inject(NonNullableFormBuilder)
  private readonly session = inject(ApiClient)
  private readonly router = inject(Router)
  protected readonly isSubmitting = signal(false)
  protected readonly submitted = signal(false)
  protected readonly credentialsError = signal<string | null>(null)
  protected readonly form = this.builder.group({
    email: ["", [Validators.required, Validators.email]],
    password: ["", Validators.required],
  })

  protected async login(): Promise<void> {
    if (this.isSubmitting()) return
    this.submitted.set(true)
    this.form.markAllAsTouched()
    this.credentialsError.set(null)
    if (this.form.invalid) return

    this.isSubmitting.set(true)
    try {
      const { email, password } = this.form.getRawValue()
      await this.session.login(email, password)
      await this.router.navigateByUrl("/roteiros", { replaceUrl: true })
    } catch (error: unknown) {
      this.credentialsError.set(
        error instanceof Error ? error.message : "Não foi possível entrar.",
      )
    } finally {
      this.isSubmitting.set(false)
    }
  }
}
