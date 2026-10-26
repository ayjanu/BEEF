{{- define "beef.name" -}}
{{- required "values.name is required" .Values.name -}}
{{- end -}}

{{- define "beef.labels" -}}
app.kubernetes.io/name: {{ include "beef.name" . }}
app.kubernetes.io/part-of: beef
app.kubernetes.io/version: {{ .Values.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "beef.selector" -}}
app.kubernetes.io/name: {{ include "beef.name" . }}
{{- end -}}
