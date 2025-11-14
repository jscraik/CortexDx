package cortex.release.changeset

default allow = false

rule_id := "release.changeset.required"

allow {
  has_changeset
}

allow {
  skip_release_label
}

allow {
  waiver_granted
}

deny[msg] {
  not allow
  msg := {
    "rule_id": rule_id,
    "reason": "Missing .changeset/*.md entry and skip-release label not present.",
    "remediation": [
      "Run `pnpm changeset` to add a release-note markdown file under .changeset/.",
      "Request a maintainer-approved waiver recorded in .cortexdx/waivers with status 'approved'."
    ]
  }
}

has_changeset {
  some file
  file := input.files[_]
  startswith(file.path, ".changeset/")
  endswith(file.path, ".md")
}

skip_release_label {
  some label
  label := input.labels[_]
  label == "skip-release"
}

waiver_granted {
  some waiver
  waiver := input.waivers[_]
  waiver.rule_id == rule_id
  waiver.status == "approved"
}
