import string

from scim2_filter_parser.transpilers.sql import Transpiler


class PatchedTranspiler(Transpiler):
    """
    This is a fixed version of the upstream sql transpiler that converts SCIM queries
    to SQL queries.

    Specifically it fixes the upper limit of 26 conditions for the search endpoint due
    to the upstream library using the ascii alphabet for query parameters.
    """

    def get_next_id(self):
        """Convert the current index to a base26 string"""
        chars = string.ascii_lowercase
        index = len(self.params)

        return (chars[-1] * int(index / len(chars))) + chars[index % len(chars)]
