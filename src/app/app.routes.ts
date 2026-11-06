import { inject } from "@angular/core"
import {
  RedirectCommand,
  Router,
  type CanActivateFn,
  type CanDeactivateFn,
  type ResolveFn,
  type Routes,
} from "@angular/router"
import { ApiClient } from "./core/api-client.service"
import { ScriptsService } from "./core/scripts.service"
import type { Script } from "./models/script.model"
import { LoginComponent } from "./pages/login/login.component"
import { OperatorComponent } from "./pages/operator/operator.component"
import { ProjectionComponent } from "./pages/projection/projection.component"
import { ScriptsComponent } from "./pages/scripts/scripts.component"

const sessionGuard: CanActivateFn = () =>
  inject(ApiClient).isSignedIn()
    ? true
    : inject(Router).createUrlTree(["/login"])

const loginGuard: CanActivateFn = () =>
  inject(ApiClient).isSignedIn()
    ? inject(Router).createUrlTree(["/roteiros"])
    : true

const pendingChangesGuard: CanDeactivateFn<ScriptsComponent> = (component) =>
  component.confirmDiscard()

const savedScriptResolver: ResolveFn<Script> = async (route) => {
  const store = inject(ScriptsService)
  const router = inject(Router)
  try {
    const script = await store.findById(route.paramMap.get("id") ?? "")
    if (!script.content.trim())
      throw new Error("Este roteiro não tem blocos de fala para apresentar.")
    return script
  } catch (error) {
    return new RedirectCommand(
      router.createUrlTree(["/roteiros"], {
        queryParams: {
          notice:
            error instanceof Error
              ? error.message
              : "Não foi possível abrir o roteiro.",
        },
      }),
    )
  }
}

export const routes: Routes = [
  {
    path: "",
    pathMatch: "full",
    redirectTo: () => (inject(ApiClient).isSignedIn() ? "/roteiros" : "/login"),
  },
  { path: "login", component: LoginComponent, canActivate: [loginGuard] },
  {
    path: "roteiros",
    component: ScriptsComponent,
    canActivate: [sessionGuard],
    canDeactivate: [pendingChangesGuard],
  },
  {
    path: "operador/:id",
    component: OperatorComponent,
    canActivate: [sessionGuard],
    resolve: { script: savedScriptResolver },
  },
  // Projection has no login session and no stored-script resolver. Its receiver
  // renders only after a checked handshake with the actual opening window.
  { path: "projecao/:presentationId", component: ProjectionComponent },
  { path: "**", redirectTo: "" },
]
