import { bootstrapApplication } from "@angular/platform-browser"
import { AppComponent } from "./app/app.component"
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from "@angular/router"
import { routes } from "./app/app.routes"

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: "top" }))],
}).catch((error: unknown) => {
  console.error(error)
})
