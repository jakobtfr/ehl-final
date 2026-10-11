"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUpRight, Info } from "lucide-react";
import type { ConfiguratorReference } from "@/lib/vehicle-models";

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Official BMW USA configurator context: current specs and the 36-frame exterior walkaround. */
export function VehicleConfigurator({ data }: { data: ConfiguratorReference }) {
  const [modelIndex, setModelIndex] = useState(0);
  const [frame, setFrame] = useState(0);
  const drag = useRef<{ x: number; frame: number } | null>(null);
  const model = data.models[Math.min(modelIndex, data.models.length - 1)];
  const frames = model.images.walkaround;

  useEffect(() => {
    // Warm the remaining frames once the first is shown so turning the car does not flicker.
    const images = frames.map((src) => { const image = new Image(); image.decoding = "async"; image.src = src; return image; });
    return () => images.forEach((image) => { image.src = ""; });
  }, [frames]);

  const step = (delta: number) => setFrame((current) => (current + delta + frames.length) % frames.length);
  const specs: [string, string | null][] = [
    ["Starting MSRP", `${usd.format(model.msrp)}${model.destinationAndHandling ? ` + ${usd.format(model.destinationAndHandling)} destination` : ""}`],
    ["Power", model.horsepower ? `${model.horsepower} hp${model.horsepowerNote ? "*" : ""}` : null],
    ["0–60 mph", model.acceleration0to60s ? `${model.acceleration0to60s} s` : null],
    ["Range", model.range],
    ["Powertrain", model.powertrain],
    ["Drivetrain", model.driveTrain],
    ["DC fast charging", model.dcCharging],
    ["Level 2 charging", model.level2Charging],
  ];

  return <section className="studio-configurator" aria-label="BMW configurator reference">
    <div className="studio-requirements-heading">
      <div>
        <span className="mono">04 / CONFIGURATOR REFERENCE</span>
        <h2>BMW {model.name} · MY{model.modelYear}</h2>
        <p>{data.source}, {data.market} · checked {data.checkedDate}. Official vehicle context, never customer evidence.</p>
      </div>
      <a href={model.buildUrl} target="_blank" rel="noreferrer">Open in BMW configurator <ArrowUpRight size={15} /></a>
    </div>
    {data.models.length > 1 && <div className="studio-model-switch studio-configurator-models" aria-label="Configurator model">
      {data.models.map((item, index) => <button key={item.code} type="button" aria-pressed={index === modelIndex}
        onClick={() => { setModelIndex(index); setFrame(0); }}>{item.name}</button>)}
    </div>}
    {data.note && <p className="studio-disclosure studio-configurator-note"><Info size={15} /><span>{data.note}</span></p>}
    <div className="studio-configurator-body">
      <figure className="studio-spin"
        onPointerDown={(event) => { drag.current = { x: event.clientX, frame }; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={(event) => {
          if (!drag.current) return;
          const delta = Math.round((drag.current.x - event.clientX) / 14);
          setFrame(((drag.current.frame + delta) % frames.length + frames.length) % frames.length);
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
      >
        {/* Hotlinked BMW configurator render; BMW offered these views to teams for visualisation. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={frames[frame] || model.images.front} alt={`BMW ${model.name} configurator exterior view ${frame + 1} of ${frames.length}`} draggable={false} />
        <div className="studio-spin-controls">
          <button type="button" onClick={() => step(-1)} aria-label="Turn left">‹</button>
          <input type="range" min={0} max={Math.max(frames.length - 1, 0)} value={frame} onChange={(event) => setFrame(Number(event.target.value))} aria-label="Rotate configurator view" />
          <button type="button" onClick={() => step(1)} aria-label="Turn right">›</button>
        </div>
        <figcaption>Drag to turn · BMW configurator render ({data.market} {model.code})</figcaption>
      </figure>
      <dl className="studio-specs">
        {specs.filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
    </div>
    {model.horsepowerNote && <p className="studio-spec-footnote">* {model.horsepowerNote} Figures as published in the configurator; equipment, prices and range vary by build.</p>}
  </section>;
}
