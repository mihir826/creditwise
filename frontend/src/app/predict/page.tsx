import type { Metadata } from "next";
import { PredictView } from "./predict-view";

export const metadata: Metadata = { title: "Approval prediction" };

export default function PredictPage() {
  return <PredictView />;
}
