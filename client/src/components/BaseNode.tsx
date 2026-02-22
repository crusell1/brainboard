import { forwardRef } from "react";

export type BaseNodeProps = Omit<
  React.HTMLAttributes<HTMLDivElement>,
  "title"
> & {
  selected?: boolean;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  accentColor?: string;
  children?: React.ReactNode;
};

export const BaseNode = forwardRef<HTMLDivElement, BaseNodeProps>(
  (
    {
      selected,
      title,
      icon,
      headerActions,
      accentColor = "#6366f1",
      children,
      style,
      className,
      ...props
    },
    ref,
  ) => {
    return (
      <div
        ref={ref}
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          minWidth: 300,
          minHeight: 150,
          borderRadius: 16,
          // Deep Glass Style
          background:
            "linear-gradient(145deg, rgba(30,30,35,0.9), rgba(20,20,25,0.95))",
          backdropFilter: "blur(12px)",
          border: selected
            ? `4px solid ${accentColor}`
            : `4px solid ${accentColor}`,
          boxShadow: selected
            ? `0 0 25px ${accentColor}30` // Mjukare glow
            : "0 4px 6px -1px rgba(0, 0, 0, 0.2), 0 2px 4px -1px rgba(0, 0, 0, 0.1)",
          color: "#e2e8f0",
          transition: "all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)",
          touchAction: "none", // Förhindra browser-zoom/pan
          willChange: "width, height, transform",
          ...style,
        }}
        className={className}
        {...props}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
            background: `${accentColor}55`, // Diskret nyans av nodens färg
            borderTopLeftRadius: 12, // 16px (parent) - 4px (border) = 12px
            borderTopRightRadius: 12,
            minHeight: 48,
            gap: 12,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              flex: 1,
              overflow: "hidden",
            }}
          >
            {icon && (
              <div style={{ color: accentColor, display: "flex" }}>{icon}</div>
            )}
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                flex: 1,
                color: "#f1f5f9",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
            </div>
          </div>
          {headerActions && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {headerActions}
            </div>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {children}
        </div>
      </div>
    );
  },
);

BaseNode.displayName = "BaseNode";
