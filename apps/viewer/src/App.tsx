import { useState, useCallback, useEffect } from "react";
import type { TreatmentFileType } from "stagebook";
import { loadTreatmentFromUrl } from "./lib/loader";
import {
  expandTreatmentFile,
  TreatmentValidationError,
  type ValidationIssue,
} from "./lib/treatment";
import { LandingPage } from "./components/LandingPage";
import { TreatmentPicker } from "./components/TreatmentPicker";
import { FieldForm } from "./components/FieldForm";
import { Viewer } from "./components/Viewer";

type AppState =
  | { phase: "landing" }
  | { phase: "loading"; url: string }
  | {
      phase: "selecting";
      treatmentFile: TreatmentFileType;
      rawBaseUrl: string;
      unresolvedFields: string[];
    }
  | {
      phase: "fields";
      treatmentFile: TreatmentFileType;
      rawBaseUrl: string;
      unresolvedFields: string[];
      selectedIntroIndex: number;
      selectedTreatmentIndex: number;
    }
  | {
      phase: "viewing";
      treatmentFile: TreatmentFileType;
      rawBaseUrl: string;
      selectedIntroIndex: number;
      selectedTreatmentIndex: number;
    }
  | {
      phase: "error";
      message: string;
      url?: string;
      validationIssues?: ValidationIssue[];
    };

export function App() {
  const [state, setState] = useState<AppState>({ phase: "landing" });

  const handleLoad = useCallback(async (url: string) => {
    setState({ phase: "loading", url });
    try {
      const { treatmentFile, unresolvedFields, rawBaseUrl } =
        await loadTreatmentFromUrl(url);

      const needsPicker =
        treatmentFile.introSequences.length > 1 ||
        treatmentFile.treatments.length > 1;

      if (needsPicker) {
        setState({
          phase: "selecting",
          treatmentFile,
          rawBaseUrl,
          unresolvedFields,
        });
      } else if (unresolvedFields.length > 0) {
        setState({
          phase: "fields",
          treatmentFile,
          rawBaseUrl,
          unresolvedFields,
          selectedIntroIndex: 0,
          selectedTreatmentIndex: 0,
        });
      } else {
        setState({
          phase: "viewing",
          treatmentFile,
          rawBaseUrl,
          selectedIntroIndex: 0,
          selectedTreatmentIndex: 0,
        });
      }
    } catch (err) {
      const validationIssues =
        err instanceof TreatmentValidationError ? err.issues : undefined;
      setState({
        phase: "error",
        message: err instanceof Error ? err.message : String(err),
        url,
        validationIssues,
      });
    }
  }, []);

  // Auto-load from ?url= parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const url = params.get("url");
    if (url && state.phase === "landing") {
      handleLoad(url);
    }
  }, [handleLoad, state.phase]);

  switch (state.phase) {
    case "landing":
      return <LandingPage onLoad={handleLoad} />;

    case "loading":
      return <LoadingScreen url={state.url} />;

    case "error":
      return (
        <ErrorScreen
          message={state.message}
          validationIssues={state.validationIssues}
          onRetry={state.url ? () => handleLoad(state.url!) : undefined}
          onBack={() => setState({ phase: "landing" })}
        />
      );

    case "selecting": {
      const { treatmentFile, rawBaseUrl, unresolvedFields } = state;
      return (
        <TreatmentPicker
          treatmentFile={treatmentFile}
          onSelect={(introIndex, treatmentIndex) => {
            if (unresolvedFields.length > 0) {
              setState({
                phase: "fields",
                treatmentFile,
                rawBaseUrl,
                unresolvedFields,
                selectedIntroIndex: introIndex,
                selectedTreatmentIndex: treatmentIndex,
              });
            } else {
              setState({
                phase: "viewing",
                treatmentFile,
                rawBaseUrl,
                selectedIntroIndex: introIndex,
                selectedTreatmentIndex: treatmentIndex,
              });
            }
          }}
        />
      );
    }

    case "fields": {
      const {
        treatmentFile,
        rawBaseUrl,
        unresolvedFields,
        selectedIntroIndex,
        selectedTreatmentIndex,
      } = state;
      return (
        <FieldForm
          unresolvedFields={unresolvedFields}
          onSubmit={(values) => {
            const { result } = expandTreatmentFile(treatmentFile, values);
            setState({
              phase: "viewing",
              treatmentFile: result,
              rawBaseUrl,
              selectedIntroIndex,
              selectedTreatmentIndex,
            });
          }}
        />
      );
    }

    case "viewing":
      return (
        <Viewer
          treatmentFile={state.treatmentFile}
          rawBaseUrl={state.rawBaseUrl}
          selectedIntroIndex={state.selectedIntroIndex}
          selectedTreatmentIndex={state.selectedTreatmentIndex}
          onBack={() => setState({ phase: "landing" })}
        />
      );
  }
}

function LoadingScreen({ url }: { url: string }) {
  return (
    <div style={centeredStyle}>
      <p style={{ color: "#6b7280" }}>Loading treatment file...</p>
      <p style={{ fontSize: "0.75rem", color: "#9ca3af", marginTop: "0.5rem" }}>
        {url}
      </p>
    </div>
  );
}

function ErrorScreen({
  message,
  validationIssues,
  onRetry,
  onBack,
}: {
  message: string;
  validationIssues?: ValidationIssue[];
  onRetry?: () => void;
  onBack: () => void;
}) {
  return (
    <div style={centeredStyle}>
      <div style={{ maxWidth: "36rem", width: "100%", padding: "2rem" }}>
        <p style={{ color: "#ef4444", fontWeight: 600 }}>Failed to load</p>

        {validationIssues ? (
          <>
            <p
              style={{
                color: "#6b7280",
                fontSize: "0.875rem",
                marginTop: "0.5rem",
              }}
            >
              The treatment file has validation errors:
            </p>
            <ul style={issueListStyle}>
              {validationIssues.map((issue, i) => (
                <li key={i} style={issueItemStyle}>
                  <code style={issuePathStyle}>{issue.path}</code>
                  <span>{issue.message}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p
            style={{
              color: "#6b7280",
              fontSize: "0.875rem",
              marginTop: "0.5rem",
              wordBreak: "break-word",
            }}
          >
            {message}
          </p>
        )}

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          {onRetry && (
            <button onClick={onRetry} style={buttonStyle}>
              Retry
            </button>
          )}
          <button
            onClick={onBack}
            style={{ ...buttonStyle, backgroundColor: "#6b7280" }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}

const issueListStyle: React.CSSProperties = {
  listStyle: "none",
  padding: 0,
  marginTop: "0.75rem",
  display: "flex",
  flexDirection: "column",
  gap: "0.5rem",
};

const issueItemStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.125rem",
  padding: "0.5rem 0.75rem",
  backgroundColor: "#fef2f2",
  borderRadius: "0.375rem",
  border: "1px solid #fecaca",
  fontSize: "0.875rem",
  color: "#374151",
};

const issuePathStyle: React.CSSProperties = {
  fontSize: "0.75rem",
  color: "#9ca3af",
  fontFamily: "monospace",
};

const centeredStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: "100vh",
};

const buttonStyle: React.CSSProperties = {
  padding: "0.5rem 1rem",
  borderRadius: "0.375rem",
  border: "none",
  backgroundColor: "#3b82f6",
  color: "white",
  cursor: "pointer",
  fontSize: "0.875rem",
};
