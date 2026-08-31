import type { Tour, Tours } from "aunboard";
// The committed artifact: the exact JSON the recorder exports, checked into the repo.
// CI replays it against a real build (see ../README.md), so a UI change that breaks a
// step fails review instead of a viewer's walkthrough.
import artifact from "../tours/demo.tour.json";

export const demoTour = artifact.tour as Tour;

export const tours: Tours = { [demoTour.id]: demoTour };
