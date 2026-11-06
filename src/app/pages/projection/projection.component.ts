import {
  ChangeDetectionStrategy,
  Component,
  OnChanges,
  inject,
  input,
} from "@angular/core"
import { ProjectionReceiverService } from "../../presentation/projection-receiver.service"
import { PresenterViewComponent } from "../../presenter-view/presenter-view.component"

@Component({
  selector: "tp-projection",
  standalone: true,
  imports: [PresenterViewComponent],
  providers: [ProjectionReceiverService],
  templateUrl: "./projection.component.html",
  styleUrl: "./projection.component.css",
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProjectionComponent implements OnChanges {
  readonly presentationId = input.required<string>()
  protected readonly receiver = inject(ProjectionReceiverService)
  protected readonly canClose = Boolean(window.opener)

  ngOnChanges(): void {
    this.receiver.connect(this.presentationId())
  }

  protected closeWindow(): void {
    this.receiver.stop()
    window.close()
  }
}
