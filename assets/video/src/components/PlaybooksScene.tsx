import { AbsoluteFill, useCurrentFrame, interpolate, spring, useVideoConfig } from "remotion";
import { theme } from "./theme";
import { SkillsShIcon, AwesomeIcon, OpenSkillsIcon } from "./ToolIcons";

// Build log entries — each appears at a specific frame with a typing effect
const buildSteps = [
  // Phase 1: Scanning sources (frames 20-55)
  { frame: 20,  icon: "🔍", text: "Scanning Skills.sh registry...", color: theme.brand1, phase: "scan" },
  { frame: 32,  icon: "🔍", text: "Scanning Awesome Claude Code...", color: theme.brand2, phase: "scan" },
  { frame: 44,  icon: "🔍", text: "Scanning SkillsBench...", color: theme.green, phase: "scan" },
  // Phase 2: Installing skills (frames 55-95)
  { frame: 58,  icon: "⚡", text: "Installed skill: add-api-route", color: theme.brand3, phase: "skill" },
  { frame: 68,  icon: "⚡", text: "Installed skill: drizzle-migrate", color: theme.brand3, phase: "skill" },
  { frame: 78,  icon: "⚡", text: "Installed skill: auth-middleware", color: theme.brand3, phase: "skill" },
  { frame: 88,  icon: "⚡", text: "Installed skill: test-patterns", color: theme.brand3, phase: "skill" },
  // Phase 3: Config files (frames 100-130)
  { frame: 102, icon: "📝", text: "Generated CLAUDE.md — 847 lines, 6 sections", color: theme.accent, phase: "config" },
  { frame: 115, icon: "📝", text: "Generated .cursor/rules/ — 12 rule files", color: theme.accent, phase: "config" },
  { frame: 128, icon: "📝", text: "Generated AGENTS.md + copilot-instructions.md", color: theme.accent, phase: "config" },
  // Phase 4: MCPs (frames 138-160)
  { frame: 140, icon: "🔌", text: "Added MCP: context7 — documentation lookup", color: "#c4b5fd", phase: "mcp" },
  { frame: 152, icon: "🔌", text: "Added MCP: postgres — database tools", color: "#c4b5fd", phase: "mcp" },
  // Phase 5: Learning (frames 168-195)
  { frame: 168, icon: "🧠", text: "Created CALIBER_LEARNINGS.md — persistent memory", color: theme.green, phase: "learn" },
  { frame: 182, icon: "🧠", text: "Indexed 14 past sessions → patterns extracted", color: theme.green, phase: "learn" },
  { frame: 195, icon: "✓",  text: "Setup complete — 94/100 Grade A", color: theme.green, phase: "done" },
];

// File tree items — appear on the right as files get created
const fileTree = [
  { name: "CLAUDE.md", indent: 0, appearsAt: 102, status: "new", size: "847 lines" },
  { name: ".cursor/", indent: 0, appearsAt: 115, status: "dir", size: "" },
  { name: "rules/", indent: 1, appearsAt: 115, status: "dir", size: "" },
  { name: "api-patterns.mdc", indent: 2, appearsAt: 117, status: "new", size: "" },
  { name: "testing.mdc", indent: 2, appearsAt: 119, status: "new", size: "" },
  { name: "security.mdc", indent: 2, appearsAt: 121, status: "new", size: "" },
  { name: "AGENTS.md", indent: 0, appearsAt: 128, status: "new", size: "4 agents" },
  { name: "copilot-instructions.md", indent: 0, appearsAt: 130, status: "new", size: "" },
  { name: ".claude/", indent: 0, appearsAt: 140, status: "dir", size: "" },
  { name: "settings.local.json", indent: 1, appearsAt: 142, status: "mcp", size: "2 MCPs" },
  { name: "CALIBER_LEARNINGS.md", indent: 0, appearsAt: 168, status: "learn", size: "14 sessions" },
];

const registries = [
  { name: "Skills.sh", Icon: SkillsShIcon, color: theme.brand1 },
  { name: "Awesome Claude Code", Icon: AwesomeIcon, color: theme.brand2 },
  { name: "SkillsBench", Icon: OpenSkillsIcon, color: theme.green },
];

export const PlaybooksScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headerOpacity = interpolate(frame, [0, 14], [0, 1], { extrapolateRight: "clamp" });

  // Blinking cursor for terminal
  const cursorVisible = Math.floor(frame / 12) % 2 === 0;

  // Scroll the build log when it gets long (after frame 120)
  const scrollOffset = frame > 120
    ? interpolate(frame, [120, 195], [0, -180], { extrapolateRight: "clamp" })
    : 0;

  // Phase labels
  const phaseLabel = frame < 55 ? "Scanning registries..."
    : frame < 98 ? "Installing skills..."
    : frame < 138 ? "Generating configs..."
    : frame < 165 ? "Configuring MCPs..."
    : frame < 195 ? "Building persistent memory..."
    : "Setup complete!";

  const phaseLabelOpacity = interpolate(frame, [16, 24], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-start",
        alignItems: "center",
        paddingTop: 30,
        background: `radial-gradient(ellipse 50% 40% at 40% 50%, ${theme.brand3}06, transparent)`,
      }}
    >
      {/* Headline */}
      <div
        style={{
          fontSize: 46,
          fontWeight: 700,
          fontFamily: theme.fontSans,
          color: theme.text,
          opacity: headerOpacity,
          letterSpacing: "-0.02em",
          marginBottom: 8,
        }}
      >
        Best playbooks, generated for your codebase
      </div>

      {/* Registry sources — compact row */}
      <div style={{ display: "flex", gap: 16, marginBottom: 18, opacity: headerOpacity }}>
        {registries.map((reg, i) => {
          const s = spring({ frame: frame - 4 - i * 3, fps, config: { damping: 14, stiffness: 90 } });
          return (
            <div
              key={reg.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 16px",
                borderRadius: 20,
                backgroundColor: `${reg.color}12`,
                border: `1px solid ${reg.color}25`,
                opacity: s,
              }}
            >
              <reg.Icon size={18} color={reg.color} />
              <span style={{ fontSize: 16, fontWeight: 500, fontFamily: theme.fontSans, color: reg.color }}>
                {reg.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Main content: Terminal build log (left) + File tree (right) */}
      <div style={{ display: "flex", gap: 24, width: 1140, maxHeight: 480 }}>

        {/* Left: Terminal build log */}
        <div
          style={{
            flex: 1,
            backgroundColor: theme.surface,
            border: `1px solid ${theme.surfaceBorder}`,
            borderRadius: theme.radiusLg,
            overflow: "hidden",
            boxShadow: theme.terminalGlow,
          }}
        >
          {/* Terminal header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              padding: "10px 16px",
              backgroundColor: theme.surfaceHeader,
              borderBottom: `1px solid ${theme.surfaceBorder}`,
            }}
          >
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.red }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.yellow }} />
            <div style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: theme.green }} />
            <span style={{ color: theme.textMuted, fontSize: 14, fontFamily: theme.fontMono, marginLeft: 10 }}>
              $ caliber init
            </span>
            <div
              style={{
                width: 8,
                height: 16,
                backgroundColor: theme.brand3,
                opacity: cursorVisible ? 1 : 0,
                marginLeft: 2,
              }}
            />
          </div>

          {/* Build log body */}
          <div style={{ padding: "14px 18px", overflow: "hidden", height: 360 }}>
            {/* Phase indicator */}
            <div
              style={{
                fontSize: 13,
                fontFamily: theme.fontMono,
                color: theme.brand2,
                marginBottom: 10,
                opacity: phaseLabelOpacity,
                fontWeight: 600,
              }}
            >
              {phaseLabel}
            </div>

            <div style={{ transform: `translateY(${scrollOffset}px)` }}>
              {buildSteps.map((step, i) => {
                const stepOpacity = interpolate(frame, [step.frame, step.frame + 6], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });
                const stepX = interpolate(frame, [step.frame, step.frame + 8], [-12, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });

                // Typing effect: characters reveal over time
                const charCount = step.text.length;
                const typedChars = Math.round(
                  interpolate(frame, [step.frame, step.frame + Math.min(charCount * 0.4, 12)], [0, charCount], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  })
                );
                const displayText = step.text.substring(0, typedChars);

                // Checkmark appears after typing
                const checkOpacity = interpolate(frame, [step.frame + 10, step.frame + 14], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                });

                return (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      marginBottom: 6,
                      opacity: stepOpacity,
                      transform: `translateX(${stepX}px)`,
                      fontFamily: theme.fontMono,
                      fontSize: 15,
                      lineHeight: 1.7,
                    }}
                  >
                    <span style={{ width: 20, textAlign: "center", fontSize: 14 }}>{step.icon}</span>
                    <span style={{ color: step.color }}>{displayText}</span>
                    {step.phase !== "done" && (
                      <span style={{ color: theme.green, opacity: checkOpacity, fontWeight: 700, fontSize: 13 }}>✓</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Live file tree */}
        <div
          style={{
            width: 380,
            backgroundColor: theme.surface,
            border: `1px solid ${theme.surfaceBorder}`,
            borderRadius: theme.radiusLg,
            overflow: "hidden",
            boxShadow: theme.cardGlow,
          }}
        >
          {/* File tree header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 16px",
              backgroundColor: theme.surfaceHeader,
              borderBottom: `1px solid ${theme.surfaceBorder}`,
            }}
          >
            <span style={{ color: theme.textMuted, fontSize: 14, fontFamily: theme.fontMono }}>
              Generated Files
            </span>
            {/* File counter */}
            <span
              style={{
                marginLeft: "auto",
                fontSize: 12,
                fontFamily: theme.fontMono,
                color: theme.brand3,
                fontWeight: 600,
              }}
            >
              {fileTree.filter(f => frame >= f.appearsAt && f.status !== "dir").length} files
            </span>
          </div>

          {/* File tree body */}
          <div style={{ padding: "12px 16px" }}>
            {fileTree.map((file, i) => {
              const fileOpacity = interpolate(frame, [file.appearsAt, file.appearsAt + 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              const fileX = interpolate(frame, [file.appearsAt, file.appearsAt + 8], [10, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });

              const isDir = file.status === "dir";
              const statusColor = file.status === "new" ? theme.green
                : file.status === "mcp" ? "#c4b5fd"
                : file.status === "learn" ? theme.brand2
                : theme.textMuted;

              const statusBadge = file.status === "new" ? "NEW"
                : file.status === "mcp" ? "MCP"
                : file.status === "learn" ? "MEMORY"
                : null;

              return (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    paddingLeft: file.indent * 18,
                    marginBottom: 4,
                    opacity: fileOpacity,
                    transform: `translateX(${fileX}px)`,
                    fontFamily: theme.fontMono,
                    fontSize: 14,
                    lineHeight: 1.8,
                  }}
                >
                  {/* File/folder icon */}
                  <span style={{ color: isDir ? theme.brand1 : theme.textSecondary, fontSize: 13 }}>
                    {isDir ? "📁" : "📄"}
                  </span>

                  {/* File name */}
                  <span style={{ color: isDir ? theme.brand1 : theme.text, fontWeight: isDir ? 600 : 400 }}>
                    {file.name}
                  </span>

                  {/* Status badge */}
                  {statusBadge && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: 10,
                        backgroundColor: `${statusColor}15`,
                        color: statusColor,
                        letterSpacing: "0.05em",
                      }}
                    >
                      {statusBadge}
                    </span>
                  )}

                  {/* Size info */}
                  {file.size && !statusBadge && (
                    <span style={{ marginLeft: "auto", fontSize: 11, color: theme.textMuted }}>
                      {file.size}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: completion summary bar */}
      <div
        style={{
          position: "absolute",
          bottom: "4%",
          display: "flex",
          alignItems: "center",
          gap: 20,
          opacity: interpolate(frame, [200, 215], [0, 1], { extrapolateRight: "clamp" }),
        }}
      >
        {[
          { label: "4 Skills", color: theme.brand3 },
          { label: "5 Config files", color: theme.accent },
          { label: "2 MCPs", color: "#c4b5fd" },
          { label: "Persistent memory", color: theme.green },
        ].map((item, i) => {
          const s = spring({ frame: frame - 200 - i * 4, fps, config: { damping: 14, stiffness: 80 } });
          return (
            <div
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 20px",
                borderRadius: 24,
                backgroundColor: `${item.color}10`,
                border: `1px solid ${item.color}22`,
                opacity: s,
                transform: `translateY(${interpolate(s, [0, 1], [10, 0])}px)`,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: item.color,
                  boxShadow: `0 0 8px ${item.color}40`,
                }}
              />
              <span style={{ fontSize: 18, fontWeight: 600, fontFamily: theme.fontSans, color: item.color }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
