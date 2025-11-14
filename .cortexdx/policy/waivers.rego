package cortex.waivers

thirty_days_ns := 30 * 24 * 60 * 60 * 1000000000

timestamp_pattern := "^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})$"

waiver_ref(waiver) := ref {
  ref := waiver.waiver_id
} else := ref {
  ref := waiver.id
} else := ref {
  ref := "waiver"
}

deny[msg] {
  waiver := input.waivers[_]
  not waiver_has_approver(waiver)
  msg := sprintf("%s is missing approved_by metadata", [waiver_ref(waiver)])
}

deny[msg] {
  waiver := input.waivers[_]
  waiver_has_approver(waiver)
  not waiver_has_maintainer(waiver)
  msg := sprintf("%s must include at least one Maintainer approver", [waiver_ref(waiver)])
}

deny[msg] {
  waiver := input.waivers[_]
  not waiver_has_expires(waiver)
  msg := sprintf("%s is missing an expires timestamp", [waiver_ref(waiver)])
}

deny[msg] {
  waiver := input.waivers[_]
  waiver_has_expires(waiver)
  not is_valid_timestamp(waiver.expires)
  msg := sprintf("%s has an invalid expires timestamp", [waiver_ref(waiver)])
}

deny[msg] {
  waiver := input.waivers[_]
  created_ns := waiver_created_ns(waiver)
  expires_ns := waiver_expires_ns(waiver)
  diff := expires_ns - created_ns
  diff > thirty_days_ns
  msg := sprintf("%s expires more than 30 days after creation", [waiver_ref(waiver)])
}

deny[msg] {
  waiver := input.waivers[_]
  not waiver_has_created(waiver)
  msg := sprintf("%s is missing creation metadata", [waiver_ref(waiver)])
}

waiver_has_approver(waiver) {
  is_array(waiver.approved_by)
  count(waiver.approved_by) > 0
}

waiver_has_approver(waiver) {
  is_object(waiver.approved_by)
}

waiver_has_approver(waiver) {
  is_string(waiver.approved_by)
  trim_space(waiver.approved_by) != ""
}

waiver_has_maintainer(waiver) {
  is_array(waiver.approved_by)
  some i
  has_maintainer_role_entry(waiver.approved_by[i])
}

waiver_has_maintainer(waiver) {
  not is_array(waiver.approved_by)
  has_maintainer_role_entry(waiver.approved_by)
}

has_maintainer_role_entry(entry) {
  is_object(entry)
  role := lower(trim_space(entry.role))
  role == "maintainer"
}

has_maintainer_role_entry(entry) {
  is_object(entry)
  entry.roles[_] = role
  lower(trim_space(role)) == "maintainer"
}

has_maintainer_role_entry(entry) {
  is_string(entry)
  lower(trim_space(entry)) == "maintainer"
}

waiver_has_expires(waiver) {
  is_string(waiver.expires)
  trim_space(waiver.expires) != ""
}

is_valid_timestamp(value) {
  is_string(value)
  re_match(timestamp_pattern, value)
}

waiver_created_value(waiver) := value {
  value := waiver.created_at
} else := value {
  value := waiver.createdAt
} else := value {
  value := waiver.created
}

waiver_has_created(waiver) {
  _ := waiver_created_ns(waiver)
}

waiver_created_ns(waiver) = ns {
  value := waiver_created_value(waiver)
  is_valid_timestamp(value)
  ns := time.parse_rfc3339_ns(value)
}

waiver_expires_ns(waiver) = ns {
  is_valid_timestamp(waiver.expires)
  ns := time.parse_rfc3339_ns(waiver.expires)
}
