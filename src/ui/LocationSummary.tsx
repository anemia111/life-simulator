import type { GameState } from "../engine/types";
import { homeProperty, district } from "../engine/spatial/selectors";
import { MapPin, ArrowUpRight } from "lucide-react";
const yen = (n: number) => "¥" + Math.round(n).toLocaleString("ja-JP");
export function LocationSummary({
  g,
  onMap,
}: {
  g: GameState;
  onMap: () => void;
}) {
  return (
    <section className="card map-overview-summary">
      <MapPin size={22} />
      <div>
        <small>YOUR NEIGHBORHOOD</small>
        <h3>{homeProperty(g).name}</h3>
        <p>
          {district(homeProperty(g).districtId).name} / 月額{" "}
          {yen(
            g.spatial.leases.find((l) => l.tenantId === "player")?.rent ?? 0,
          )}{" "}
          / {g.employments.length}勤務先・
          {g.spatial.leases.filter((l) => l.tenantId !== "player").length}
          事業物件
        </p>
      </div>
      <button className="btn secondary" onClick={onMap}>
        都市マップを開く <ArrowUpRight size={16} />
      </button>
    </section>
  );
}
