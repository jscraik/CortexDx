package cortex.licenses

# Baseline allow/deny sets; inputs may extend these.
allowed_baseline := {
        "APACHE-2.0",
        "BSD-2-CLAUSE",
        "BSD-3-CLAUSE",
        "CC-BY-4.0",
        "CC0-1.0",
        "ISC",
        "MIT",
        "MPL-2.0",
        "UNLICENSE",
        "ZLIB",
}

denied_baseline := {
        "AGPL-3.0",
        "GPL-2.0",
        "GPL-3.0",
        "LGPL-2.1",
        "LGPL-3.0",
        "SSPL-1.0",
}

input_allowed[spdx] {
        spdx := upper(input.policy.allowed[_])
}

input_denied[spdx] {
        spdx := upper(input.policy.denied[_])
}

exempt_package[name] {
        name := input.policy.exemptions[_]
}

allowed_spdx[spdx] {
        spdx := allowed_baseline[_]
}

allowed_spdx[spdx] {
        spdx := input_allowed[_]
}

denied_spdx[spdx] {
        spdx := denied_baseline[_]
}

denied_spdx[spdx] {
        spdx := input_denied[_]
}

normalized_spdx(raw, normalized) {
        type_name(raw) == "string"
        trimmed := trim(raw, " \t\n\r\"'")
        normalized := upper(trimmed)
}

normalized_spdx(raw, "") {
        type_name(raw) != "string"
}

has_valid_spdx(dep) {
        dep.spdx_ids != null
        some normalized
        normalized_spdx(dep.spdx_ids[_], normalized)
        normalized != ""
        normalized != "UNKNOWN"
}

missing_spdx(dep) {
        not has_valid_spdx(dep)
}

has_allowed(dep) {
        dep.spdx_ids != null
        some normalized
        normalized_spdx(dep.spdx_ids[_], normalized)
        normalized != ""
        normalized != "UNKNOWN"
        allowed_spdx[normalized]
}

denied_license(dep, normalized) {
        dep.spdx_ids != null
        normalized_spdx(dep.spdx_ids[_], normalized)
        normalized != ""
        denied_spdx[normalized]
}

deny[msg] {
        dep := input.dependencies[_]
        not exempt_package(dep.name)
        missing_spdx(dep)
        msg := sprintf("%s:%s@%s missing SPDX identifier", [dep.ecosystem, dep.name, dep.version])
}

deny[msg] {
        dep := input.dependencies[_]
        not exempt_package(dep.name)
        denied_license(dep, spdx)
        msg := sprintf("%s:%s@%s uses denied license %s", [dep.ecosystem, dep.name, dep.version, spdx])
}

deny[msg] {
        dep := input.dependencies[_]
        not exempt_package(dep.name)
        not missing_spdx(dep)
        not denied_license(dep, _)
        not has_allowed(dep)
        msg := sprintf("%s:%s@%s license %q not in allow list", [dep.ecosystem, dep.name, dep.version, dep.raw_license_expression])
}

allow {
        not deny[_]
}
