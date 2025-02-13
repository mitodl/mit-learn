"""
SCIM filter parsers

This module aims to compliantly parse SCIM filter queries per the spec:
https://datatracker.ietf.org/doc/html/rfc7644#section-3.4.2.2

Note that this implementation defines things slightly differently
because a naive implementation exactly matching the filter grammar will
result in hitting Python's recursion limit because the grammar defines
logical lists (AND/OR chains) as a recursive relationship.

This implementation avoids that by defining separately FilterTerm and
Filter. As a result of this, some definitions are collapsed and removed
(e.g. valFilter => FilterTerm).
"""

from pyparsing import (
    CaselessKeyword,
    Char,
    Combine,
    DelimitedList,
    FollowedBy,
    Forward,
    Group,
    Literal,
    alphanums,
    alphas,
    common,
    dbl_quoted_string,
    nested_expr,
    one_of,
    remove_quotes,
)

NameChar = Char(alphanums + "_-")
AttrName = Combine(
    Char(alphas)
    + NameChar[...]
    # ensure we're not somehow parsing an URN
    + ~FollowedBy(":")
).set_results_name("attr_name")

# Example URN-qualifed attr:
# urn:ietf:params:scim:schemas:core:2.0:User:userName
# |--------------- URN --------------------|:| attr |
UrnAttr = Combine(
    Combine(
        Literal("urn:")
        + DelimitedList(
            # characters ONLY if followed by colon
            Char(alphanums + ".-_")[1, ...] + FollowedBy(":"),
            # separator
            Literal(":"),
            # combine everything back into a singular token
            combine=True,
        )[1, ...]
    ).set_results_name("urn")
    # separator between URN and attribute name
    + Literal(":")
    + AttrName
)


SubAttr = Combine(Literal(".") + AttrName.set_results_name("sub_attr"))

AttrPath = Combine(
    (
        # match on UrnAttr first
        UrnAttr ^ AttrName
    )
    + SubAttr[..., 1]
)

ComparisonOperator = one_of(
    ["eq", "ne", "co", "sw", "ew", "gt", "lt", "ge", "le"],
    caseless=True,
    as_keyword=True,
).set_results_name("comparison_operator")
LogicalOperator = one_of(["or", "and"], caseless=True).set_results_name(
    "logical_operator"
)
NegationOperator = (
    CaselessKeyword("not").set_results_name("negated").set_parse_action(lambda: True)
)

ValueTrue = Literal("true").set_parse_action(lambda: True)
ValueFalse = Literal("false").set_parse_action(lambda: False)
ValueNull = Literal("null").set_parse_action(lambda: None)
ValueNumber = common.integer | common.fnumber
ValueString = dbl_quoted_string.set_parse_action(remove_quotes)

ComparisonValue = (
    ValueTrue | ValueFalse | ValueNull | ValueNumber | ValueString
).set_results_name("value")

AttrPresence = Group(
    AttrPath + Literal("pr").set_results_name("presence").set_parse_action(lambda: True)
)
AttrExpression = AttrPresence | Group(AttrPath + ComparisonOperator + ComparisonValue)

# these are forward references, so that we can have
# parsers circularly reference themselves
FilterTerm = Forward()
FilterTermList = Forward()

ValuePath = Group(AttrPath + nested_expr("[", "]", FilterTermList)).set_results_name(
    "value_path"
)

FilterTerm <<= (
    AttrExpression
    | ValuePath
    | (NegationOperator[..., 1] + nested_expr("(", ")", FilterTermList))
)

FilterTermList <<= FilterTerm + (LogicalOperator + FilterTerm)[...]
