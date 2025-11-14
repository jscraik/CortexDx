package cortex.waivers_test

import data.cortexdx.waivers

valid_input := data.valid
expired_input := data.expired
malformed_input := data.malformed

test_valid_waiver_is_permitted {
  count({msg | waivers.deny[msg] with input as valid_input}) == 0
}

test_expired_waiver_is_rejected {
  waivers.deny[msg] with input as expired_input
  msg == "expired-waiver expires more than 30 days after creation"
}

test_malformed_waivers_are_flagged {
  denies := {msg | waivers.deny[msg] with input as malformed_input}
  expected := {
    "no-approver-waiver is missing approved_by metadata",
    "wrong-role-waiver must include at least one Maintainer approver",
    "missing-expiry-waiver is missing an expires timestamp",
    "invalid-expiry-format has an invalid expires timestamp"
  }
  denies == expected
}
