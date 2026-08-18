{{/*
Common labels applied to every resource in this chart.
*/}}
{{- define "luminai-platform.labels" -}}
app.kubernetes.io/part-of: luminai-platform
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}

{{/*
Component-specific selector labels. Pass the component name as the argument, e.g.
{{ include "luminai-platform.selectorLabels" "core-backend" }}
*/}}
{{- define "luminai-platform.selectorLabels" -}}
app.kubernetes.io/name: {{ . }}
app.kubernetes.io/instance: {{ . }}
{{- end }}