export const DotsSmall: React.FC<{ className?: string }> = ({ className }) => {
	return (
		<svg viewBox="0 0 24 24" className={className}>
			<g>
				<circle cx="5" cy="12" r="2"></circle>
				<circle cx="12" cy="12" r="2"></circle>
				<circle cx="19" cy="12" r="2"></circle>
			</g>
		</svg>
	);
};
