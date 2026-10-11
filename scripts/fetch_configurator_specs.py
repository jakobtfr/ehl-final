"""Refresh vehicle specs and reference renders from the public BMW USA configurator.

Run: python scripts/fetch_configurator_specs.py
Writes web/public/models/<asset>/configurator.json. Images are referenced by their BMW
COSY URL (BMW invited hackathon teams to use the configurator views for visualisations);
no image is copied into the repository.
"""

import json
import sys
import urllib.request
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODEL_LIST = "https://configure.bmwusa.com/UBYOConfigurator/v4/BM/modellist"
BUILD_URL = "https://www.bmwusa.com/build-your-own.html#/studio/{code}"
COSY = "https://prod.cosy.bmw.cloud/bmwweb/cosySec?{token}"

# Asset folder -> configurator model codes, first is the primary model shown in the studio.
VEHICLES = {
    "g60-us": {"codes": ["275U"], "note": None},
    "g70-us": {
        "codes": ["277Q", "277R"],
        "note": "The i7 M70 xDrive is not offered in the current BMW USA configurator (MY2027 lists i7 50 xDrive "
                "and i7 60 xDrive). The 3D model keeps the MY2024 i7 M70 reference; these specs describe the "
                "current i7 line-up.",
    },
}


def models(payload):
    if isinstance(payload, dict):
        if payload.get("code") and "modelRange" in payload:
            yield payload
        for value in payload.values():
            yield from models(value)
    elif isinstance(payload, list):
        for value in payload:
            yield from models(value)


def first(token):
    return token[0] if isinstance(token, list) else token


def spec(model):
    cosy = model.get("cosyUrls", {})
    return {
        "code": model["code"],
        "name": model["name"],
        "modelYear": model["year"],
        "modelRange": model["modelRange"],
        "msrp": model["price"],
        "destinationAndHandling": model.get("destinationAndHandling"),
        "horsepower": model.get("horsepower"),
        "horsepowerNote": model.get("packagesDisclaimer") or None,
        "acceleration0to60s": model.get("acceleration"),
        "range": model.get("totalRange") or None,
        "driveTrain": model.get("driveTrain"),
        "powertrain": model.get("technicalText"),
        "dcCharging": model.get("chargingTimeDC") or None,
        "level2Charging": model.get("chargingTimeLevel2") or None,
        "buildUrl": BUILD_URL.format(code=model["code"]),
        "images": {
            "front": COSY.format(token=first(cosy["exteriorFrontViewUrlPart"])),
            "rear": COSY.format(token=first(cosy["exteriorRearViewUrlPart"])),
            "walkaround": [COSY.format(token=t) for t in cosy.get("walkaround360DegViewUrlPart", [])],
        },
    }


def main() -> int:
    request = urllib.request.Request(MODEL_LIST, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.bmwusa.com/"})
    with urllib.request.urlopen(request, timeout=60) as response:
        catalogue = {m["code"]: m for m in models(json.load(response))}
    for folder, config in VEHICLES.items():
        missing = [code for code in config["codes"] if code not in catalogue]
        if missing:
            print(f"{folder}: configurator no longer lists {missing}", file=sys.stderr)
            return 1
        out = ROOT / "web" / "public" / "models" / folder / "configurator.json"
        out.write_text(json.dumps({
            "schemaVersion": "1.0.0",
            "source": "BMW USA Build Your Own",
            "sourceUrl": MODEL_LIST,
            "market": "US",
            "checkedDate": date.today().isoformat(),
            "classification": "official_vehicle_context",
            "customerEvidence": False,
            "note": config["note"],
            "imageUse": "Configurator views are hotlinked from BMW for visualisation, as offered to hackathon teams; not copied.",
            "models": [spec(catalogue[code]) for code in config["codes"]],
        }, indent=2) + "\n")
        print(f"wrote {out.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
