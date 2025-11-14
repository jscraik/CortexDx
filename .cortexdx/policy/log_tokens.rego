package cortex.logtokens

default allow := true

iso8601_regex := data.logtokens.iso8601
latency_regex := data.logtokens.latency
brand_prefix := data.logtokens.brandPrefix
models_token := data.logtokens.models
north_star_tokens := data.logtokens.northStar

deny[msg] {
        entry := input.log_evidence[_]
        raw := entry.raw_text
        not re_match(iso8601_regex, raw)
        msg := sprintf("log_evidence[%v] missing ISO-8601 timestamp", [entry.pointer])
}

deny[msg] {
        entry := input.log_evidence[_]
        raw := entry.raw_text
        not re_match(latency_regex, raw)
        msg := sprintf("log_evidence[%v] missing LATENCY token", [entry.pointer])
}

deny[msg] {
        entry := input.log_evidence[_]
        raw := entry.raw_text
        not contains(raw, models_token)
        msg := sprintf("log_evidence[%v] missing %v token", [entry.pointer, models_token])
}

deny[msg] {
        entry := input.log_evidence[_]
        raw := entry.raw_text
        not north_star_present(raw)
        msg := sprintf("log_evidence[%v] missing NORTH_STAR phase token", [entry.pointer])
}

deny[msg] {
        entry := input.log_evidence[_]
        raw := entry.raw_text
        not startswith(raw, brand_prefix)
        msg := sprintf("log_evidence[%v] missing %v brand prefix", [entry.pointer, brand_prefix])
}

north_star_present(raw) {
        some token in north_star_tokens
        contains(raw, token)
}
