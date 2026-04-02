import React, { ReactNode, ErrorInfo } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: "" };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: "20px", textAlign: "center", background: "#FEE2E2", color: "#DC2626", borderRadius: "12px", margin: "20px" }}>
          <h2 style={{ fontWeight: 800 }}>Oeps! Er is iets misgegaan.</h2>
          <p style={{ fontSize: "14px", marginTop: "10px" }}>{this.state.errorMessage}</p>
          <button 
            style={{ marginTop: "15px", padding: "10px 20px", background: "#DC2626", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
            onClick={() => window.location.reload()}
          >
            Pagina herladen
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
