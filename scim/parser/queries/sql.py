from scim2_filter_parser.lexer import SCIMLexer
from scim2_filter_parser.parser import SCIMParser
from scim2_filter_parser.queries.sql import SQLQuery

from scim.parser.transpilers.sql import PatchedTranspiler


class PatchedSQLQuery(SQLQuery):
    """Patched SQLQuery to use the patch transpiler"""

    def build_where_sql(self):
        self.token_stream = SCIMLexer().tokenize(self.filter)
        self.ast = SCIMParser().parse(self.token_stream)
        self.transpiler = PatchedTranspiler(self.attr_map)
        self.where_sql, self.params_dict = self.transpiler.transpile(self.ast)
