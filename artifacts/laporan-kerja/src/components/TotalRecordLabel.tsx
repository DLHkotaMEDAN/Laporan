type TotalRecordLabelProps = {
  count: number | null | undefined;
};

const TotalRecordLabel = ({ count }: TotalRecordLabelProps) => (
  <p className="pb-2 text-right text-sm font-bold text-slate-600">
    Total Data {count === null || count === undefined ? '...' : count.toLocaleString('id-ID')}
  </p>
);

export default TotalRecordLabel;
