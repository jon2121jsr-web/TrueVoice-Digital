export default function App() {

  const streamUrl = "https://stream.truevoice.digital/radio/8000/radio.mp3";

  return (
    <div
      style={{
        fontFamily: "Inter, sans-serif",
        background: "#0a0a0a",
        color: "#ffffff",
        minHeight: "100vh",
        padding: "40px 20px",
        textAlign: "center",
      }}
    >
      <h1
        style={{
          fontSize: "42px",
          fontWeight: "700",
          marginBottom: "10px",
        }}
      >
        TrueVoice Digital
      </h1>

      <p
        style={{
          fontSize: "18px",
          opacity: 0.85,
          marginBottom: "40px",
        }}
      >
        Faith. Music. Message. Streaming 24/7.
      </p>

      <audio
        controls
        style={{
          width: "100%",
          maxWidth: "380px",
          margin: "0 auto",
          outline: "none",
        }}
        src={streamUrl}
      />

      <br />
      <br />

      <p style={{ opacity: 0.6 }}>
        Powered by AzuraCast • Built by OUTPUT Digital
      </p>
    </div>
  );
}
