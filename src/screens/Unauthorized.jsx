export default function Unauthorized({ onBack }) {
  return (
    <div className="card">
      <div className="unauthorized-icon">🔒</div>
      <h1>Perfil no autorizado</h1>
      <p className="subtitle">
        Tu cuenta de Google no tiene acceso a Pamo. Debés solicitar acceso al
        equipo para poder entrar.
      </p>
      <a className="unauthorized-mail" href="mailto:soporte@pamo.com">
        Solicitar acceso
      </a>
      <div style={{ marginTop: 24 }}>
        <button className="logout-btn" onClick={onBack}>
          Volver
        </button>
      </div>
    </div>
  );
}
