const Placeholder = ({ component, height = 'auto',
    width = 'auto',
    marginTop = '20px',
    paddingTop = '30px',
    marginBottom = '20px',
    itemsCentered,
    marginLeft = '0px',
    marginRight = '0px',
    paddingLeft = '0px',
    paddingRight = '0px',
    paddingBottom = '0px',}) => {
    return (
        <div
            style={{
                background: 'var(--p-color-border-interactive-subdued)',
                height: height,
                width: width,
                borderRadius: 'inherit',

            }}
        >
            <div
                style={{
                    color: 'var(--p-color-text)',
                    marginTop: marginTop,
                    marginBottom: marginBottom,
                    marginLeft,
                    marginRight,
                    paddingTop,
                    paddingBottom,
                    paddingLeft,
                    paddingRight,
                    ...(itemsCentered && { display: 'flex', justifyContent: 'center', alignItems: 'center' })
                }}
            >
                {component}
            </div>
        </div>
    );
};

export default Placeholder