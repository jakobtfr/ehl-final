import g60 from "@/public/models/g60-us/manifest.json";
import g70 from "@/public/models/g70-us/manifest.json";
import g60Configurator from "@/public/models/g60-us/configurator.json";
import g70Configurator from "@/public/models/g70-us/configurator.json";
import type { Requirement } from "./types";
import type { VehicleTrim } from "./vehicle-badges";

export type VehicleZone = {
  anchor: string;
  position: number[];
  topics: string[];
  camera: string;
  approximation: string;
  geometry: string;
};

export type VehicleManifest = {
  id: string;
  status: string;
  vehicle: { code: string; market: string; variant: string; modelYear: number; modelYearBasis: string };
  source: { url: string; title: string; creator: string; creatorUrl: string };
  licence: { url: string; file: string; brandNotice: string };
  files: { model: { path: string }; poster: { path: string }; fallback: { path: string } };
  interior: boolean;
  interiorDescription: string;
  rendering: { paintMaterials: string[]; paintFinish: string };
  zones: Record<string, VehicleZone>;
  cameras: Record<string, { position: number[]; target: number[]; fov: number; near: number; far: number; note?: string }>;
};

export type ConfiguratorModel = {
  code: string;
  name: string;
  modelYear: number;
  msrp: number;
  destinationAndHandling: number | null;
  horsepower: number | null;
  horsepowerNote: string | null;
  acceleration0to60s: number | null;
  range: string | null;
  driveTrain: string | null;
  powertrain: string | null;
  dcCharging: string | null;
  level2Charging: string | null;
  buildUrl: string;
  images: { front: string; rear: string; walkaround: string[] };
};

/** Written by scripts/fetch_configurator_specs.py from the public BMW USA configurator. */
export type ConfiguratorReference = {
  source: string;
  market: string;
  checkedDate: string;
  note: string | null;
  models: ConfiguratorModel[];
};

export type VehicleAsset = {
  manifest: VehicleManifest;
  base: string;
  label: string;
  trim: VehicleTrim;
  configurator: ConfiguratorReference;
};

export const vehicleAssets: VehicleAsset[] = [
  {
    manifest: g60 as VehicleManifest, base: "/models/g60-us", label: "G60 · i5 M60",
    configurator: g60Configurator as ConfiguratorReference,
    trim: {
      // The artist's blue "i5"/"M60" lettering is replaced by configurator-style chrome badges.
      hideMeshes: ["mesh_badge_blue"], roundelHalo: true,
      stripLettering: { materials: ["trim_black", "lamp_rear"], boxes: [
        [[0.47, 0.97, -2.345], [0.57, 1.01, -2.3]],
        [[-0.6, 0.97, -2.345], [-0.44, 1.01, -2.29]],
      ] },
      rearRoundel: { y: 0.964, size: 0.091 }, bonnetRoundel: { z: 2.405, size: 0.09 }, wheelRoundelSize: 0.06,
      rearBadges: [
        { text: "i5", x: 0.52, y: 0.99, height: 0.032 },
        { text: "M60", mStripes: true, x: -0.52, y: 0.99, height: 0.032 },
      ],
    },
  },
  {
    manifest: g70 as VehicleManifest, base: "/models/g70-us", label: "G70 · i7 M70",
    configurator: g70Configurator as ConfiguratorReference,
    trim: {
      // The MY2024 i7 M70 shows "i7" left and the M70 designation right; it carries no xDrive script.
      hideMeshes: ["badge_rear_i7", "badge_rear_m70_xdrive"], roundelHalo: true,
      // Jagged artist emblem remnant on the bonnet nose, replaced by the roundel above the kidney grille.
      stripLettering: { materials: ["alloy_satin"], boxes: [[[-0.12, 0.797, 2.58], [0.12, 0.85, 2.64]]] },
      rearRoundel: { y: 0.997, size: 0.1 }, bonnetRoundel: { z: 2.645, size: 0.09 }, wheelRoundelSize: 0.062,
      rearBadges: [
        { text: "i7", x: 0.56, y: 1.045, height: 0.034 },
        { text: "M70", mStripes: true, x: -0.56, y: 1.045, height: 0.034 },
      ],
    },
  },
];

export const zoneNames: Record<string, string> = {
  charging: "Charging",
  battery_range: "Battery & range",
  seats_front: "Front seats",
  rear_cabin: "Rear cabin",
  cockpit: "Cockpit & controls",
  infotainment: "Infotainment",
  acoustics: "Acoustics",
  assistance: "Driver assistance",
  chassis: "Ride & handling",
  cargo: "Cargo & access",
  exterior: "Exterior design",
};

export type ZoneRollup = {
  requirements: Requirement[];
  topPriority: number | null;
  worstGrade: string | null;
  openReviews: number;
  approved: number;
};

export function buildZoneRollups(manifest: VehicleManifest, requirements: Requirement[]): Record<string, ZoneRollup> {
  const scoped = requirements.filter((item) => item.vehicle === manifest.vehicle.code && item.market === manifest.vehicle.market);
  return Object.fromEntries(Object.entries(manifest.zones).map(([id, zone]) => {
    const matches = scoped.filter((item) => zone.topics.includes(item.topic)).sort((a, b) => b.priority - a.priority);
    return [id, {
      requirements: matches,
      topPriority: matches.length ? matches[0].priority : null,
      worstGrade: matches.length ? matches.map((item) => item.evidence_grade).sort().at(-1) || null : null,
      openReviews: matches.filter((item) => item.needs_review).length,
      approved: matches.filter((item) => item.status === "approved").length,
    }];
  }));
}
