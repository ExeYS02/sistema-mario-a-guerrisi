export default function StoreFooter() {
  return (
    <footer className="store-footer">
      <div className="store-footer-inner">
        <div>
          <div className="store-footer-title">Mario A. Guerrisi</div>
          <p>Instrumentos musicales y accesorios.</p>
        </div>
        <p className="store-footer-copy">© {new Date().getFullYear()} Mario A. Guerrisi. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
