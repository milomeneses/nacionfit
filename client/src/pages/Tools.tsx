import { Card } from '../components/Card';

export function Tools() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl leading-tight text-green">
        <span className="italic text-terra">Herramientas</span>
      </h1>
      <Card pre="Urge surfing ·" em="20 min">
        <p className="font-body text-ink/70">
          Un temporizador guiado de 20 minutos para surfear el impulso hasta que
          baje. Próximamente.
        </p>
      </Card>
    </div>
  );
}
